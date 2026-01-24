/* ListJS – Standalone ES Class (no bundler, no module.exports)
 * API: new ListJS(containerOrId, options = {}, values?)
 * Methods: add, remove, get, size, clear, show, reIndex, toJSON, on, off, search, filter, sort, update
 * Events: 'updated', 'searchStart', 'searchComplete', 'filterStart', 'filterComplete', 'sortStart', 'sortComplete', 'parseComplete'
 */
class ListJS {
  // ---------- Public API ----------
  constructor (id, options = {}, values) {
    // Defaults
    this.listClass   = 'list';
    this.searchClass = 'search';
    this.sortClass   = 'sort';
    this.page        = 10000;
    this.i           = 1;
    this.items       = [];
    this.visibleItems = [];
    this.matchingItems = [];
    this.searched    = false;
    this.filtered    = false;
    this.searchColumns = undefined;
    this.searchDelay = 0;
    this.searchInfos = 0;
    this.valueNames  = [];
    this.handlers    = { updated: [] };
    this.iterationPlaceholder = '_iterate';
    this.iterationAttributes = [ 'id', 'for' ];
    this.iterationStart = 0;
    this.iterationFormatter = undefined;
    this.groupBy = undefined;

    // Utils (bound so we can pass around)
    this.utils = {
      getByClass: ListJS._getByClass,
      extend: ListJS._extend,
      indexOf: ListJS._indexOf,
      events: ListJS._events,
      toString: ListJS._toString,
      naturalSort: ListJS._naturalSort,
      classes: ListJS._classes,
      getAttribute: ListJS._getAttribute,
      toArray: ListJS._toArray
    };

    // Apply options
    this.utils.extend(this, options);

    // Resolve container
    this.listContainer = typeof id === 'string' ? document.getElementById(id) : id;
    if (!this.listContainer) return;

    // DOM hooks
    this.list = this.utils.getByClass(this.listContainer, this.listClass, true);

    // Build subsystems
    this._buildTemplater();
    this._buildSearch();
    this._buildFilter();
    this._buildSort();
    this._buildFuzzySearch(options.fuzzySearch);

    // Wire declared event handlers from options
    Object.keys(this.handlers).forEach(evt => {
      if (this[evt] && Object.prototype.hasOwnProperty.call(this.handlers, evt)) {
        this.on(evt, this[evt]);
      }
    });

    // Initial parse + optional seed values
    this._parseList();
    if (values !== undefined) this.add(values);

    // Optional pagination
    if (options.pagination !== undefined) {
      const cfgs = Array.isArray(options.pagination)
        ? (options.pagination.length ? options.pagination : [ {} ])
        : [ options.pagination ];
      cfgs.forEach(cfg => this._initPagination(cfg || {}));
    }

    this.update();
  }

  reIndex () {
    this.items = [];
    this.visibleItems = [];
    this.matchingItems = [];
    this.searched = false;
    this.filtered = false;
    this._parseList();
  }

  toJSON () {
    return this.items.map(it => it.values());
  }

  add (values, callback) {
    if (!values || values.length === 0) return;
    const addList = (Array.isArray(values) ? values : [ values ]);

    if (callback) {
      // Async chunked add for large datasets
      const queue = addList.slice();
      const items = [];
      const tick = () => {
        const chunk = queue.splice(0, 50);
        chunk.forEach(v => {
          const notCreate = this.items.length > this.page;
          const it = new ListJS._Item(this, v, undefined, notCreate);
          this.items.push(it);
          items.push(it);
        });
        if (queue.length) {
          setTimeout(tick, 1);
        } else {
          this.update();
          callback(items);
        }
      };
      tick();
      return;
    }

    const added = [];
    for (let i = 0; i < addList.length; i++) {
      const notCreate = this.items.length > this.page;
      const it = new ListJS._Item(this, addList[i], undefined, notCreate);
      this.items.push(it);
      added.push(it);
    }
    this.update();
    return added;
  }

  show (i, page) {
    this.i = i;
    this.page = page;
    this.update();
    return this;
  }

  remove (valueName, value, options) {
    let found = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].values()[valueName] == value) {
        this.templater.remove(this.items[i], options);
        this.items.splice(i, 1);
        i--; // adjust
        found++;
      }
    }
    this.update();
    return found;
  }

  get (valueName, value) {
    return this.items.filter(it => it.values()[valueName] == value);
  }

  size () { return this.items.length; }

  clear () {
    this.templater.clear();
    this.items = [];
    return this;
  }

  on (event, callback) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(callback);
    return this;
  }

  off (event, callback) {
    const e = this.handlers[event] || [];
    const idx = this.utils.indexOf(e, callback);
    if (idx > -1) e.splice(idx, 1);
    return this;
  }

  trigger (event) {
    const list = this.handlers[event] || [];
    for (let i = list.length - 1; i >= 0; i--) list[i](this);
    return this;
  }

  get reset () {
    return {
      filter: () => { this.items.forEach(it => it.filtered = false); return this; },
      search: () => { this.items.forEach(it => it.found = false); return this; }
    };
  }

  update () {
    const is = this.items;
    this.visibleItems = [];
    this.matchingItems = [];
    this.templater.clear();

    const groupBy = ListJS._normalizeGroupBy(this.groupBy);
    if (groupBy.length) {
      this._updateGrouped(is, groupBy[0]);
    } else {
      for (let i = 0; i < is.length; i++) {
        if (is[i].matching() && this.matchingItems.length + 1 >= this.i && this.visibleItems.length < this.page) {
          is[i].show();
          this.visibleItems.push(is[i]);
          this.matchingItems.push(is[i]);
        } else if (is[i].matching()) {
          this.matchingItems.push(is[i]);
          is[i].hide();
        } else {
          is[i].hide();
        }
      }
    }
    this.trigger('updated');
    return this;
  }

  _updateGrouped (items, groupBy) {
    const frag = document.createDocumentFragment();
    const ctx = {
      now: new Date(),
      weekStartsOn: groupBy.weekStartsOn
    };
    let lastGroupKey = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.matching()) continue;

      const idx = this.matchingItems.length + 1;
      this.matchingItems.push(item);
      if (idx < this.i || this.visibleItems.length >= this.page) continue;

      const groupInfo = this._getGroupForItem(item, groupBy, ctx);
      if (groupInfo) {
        if (groupInfo.key !== lastGroupKey) {
          const header = this._createGroupHeader(groupBy, groupInfo);
          if (header) frag.appendChild(header);
          lastGroupKey = groupInfo.key;
        }
      } else {
        lastGroupKey = null;
      }

      this.templater.create(item);
      this.templater._applyIterationPlaceholders(item);
      frag.appendChild(item.elm);
      this.visibleItems.push(item);
    }

    this.list.appendChild(frag);
  }

  _getGroupForItem (item, groupBy, ctx) {
    const values = item.values();
    const value = (typeof groupBy.name === 'function')
      ? groupBy.name(item, values, this)
      : ListJS._getByPath(values, groupBy.name);
    const groups = groupBy.groups || [];

    if (!groups.length) {
      if (value === undefined || value === null || value === '') return null;
      const label = ListJS._toString(value);
      return { key: label, label };
    }

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.test && group.test(value, item, this, ctx)) {
        const key = (group.id !== undefined && group.id !== null) ? group.id : group.label;
        return { key, label: group.label, group };
      }
    }

    if (groupBy.fallback !== undefined && groupBy.fallback !== null) {
      const fb = groupBy.fallback;
      if (typeof fb === 'string') return { key: fb, label: fb, group: fb };
      if (typeof fb === 'object') {
        const key = fb.id || fb.name || 'other';
        const label = fb.label || fb.title || fb.name || key;
        return { key, label, group: fb };
      }
    }

    return null;
  }

  _createGroupHeader (groupBy, info) {
    const ctx = {
      label: info.label,
      key: info.key,
      group: info.group,
      list: this
    };
    let node;
    const tag = groupBy.headerTag || this._defaultGroupTag();

    if (typeof groupBy.header === 'function') {
      node = ListJS._coerceGroupNode(groupBy.header(ctx), tag, info);
    } else if (groupBy.header !== undefined) {
      node = ListJS._coerceGroupNode(groupBy.header, tag, info);
    } else {
      node = document.createElement(tag);
      node.textContent = info.label;
    }

    if (!node) return null;
    if (groupBy.headerClass && node.classList) node.classList.add(groupBy.headerClass);
    node.setAttribute('data-listjs-group', 'true');
    node.setAttribute('data-group', ListJS._toString(info.key ?? ''));
    return node;
  }

  _defaultGroupTag () {
    const tag = this.list?.tagName?.toLowerCase() || '';
    if (tag === 'tbody' || tag === 'thead' || tag === 'tfoot') return 'tr';
    if (tag === 'ul' || tag === 'ol') return 'li';
    return 'div';
  }

  // ---------- Build subsystems ----------
  _parseList () {
    const getChildren = parent => {
      const nodes = parent.childNodes;
      const items = [];
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].data === undefined) {
          if (nodes[i].getAttribute && nodes[i].getAttribute('data-listjs-group') === 'true') continue;
          items.push(nodes[i]);
        }
      }
      return items;
    };
    const parse = (els, vnames) => {
      for (let i = 0; i < els.length; i++) {
        this.items.push(new ListJS._Item(this, vnames, els[i]));
      }
    };
    const parseAsync = (els, vnames) => {
      const chunk = els.splice(0, 50);
      parse(chunk, vnames);
      if (els.length > 0) {
        setTimeout(() => parseAsync(els, vnames), 1);
      } else {
        this.update();
        this.trigger('parseComplete');
      }
    };

    const itemsToIndex = getChildren(this.list);
    const vnames = this.valueNames;
    this.handlers.parseComplete = this.handlers.parseComplete || [];

    if (this.indexAsync) parseAsync(itemsToIndex, vnames);
    else parse(itemsToIndex, vnames);
  }

  _buildTemplater () {
    this.templater = new ListJS._Templater(this);
  }

  _buildSearch () {
    // search(str, [columns]?, customSearch?)
    const prepare = {
      resetList: () => { this.i = 1; this.templater.clear(); },
      setOptions: args => {
        // str, cols | fn | cols+fn
        if (args.length === 2 && Array.isArray(args[1])) return { columns: args[1] };
        if (args.length === 2 && typeof args[1] === 'function') return { customSearch: args[1] };
        if (args.length === 3) return { columns: args[1], customSearch: args[2] };
        return {};
      },
      setColumns: columns => {
        if (!this.items.length) return undefined;
        if (columns === undefined) {
          return this.searchColumns === undefined ? Object.keys(this.items[0].values()) : this.searchColumns;
        }
        return columns;
      },
      normalize: s => ListJS._toString(s).toLowerCase()
    };

    const runListSearch = (searchString, columns) => {
      // Support "quoted phrases" + words
      let words = [];
      let ss = searchString;
      let m;
      while ((m = ss.match(/"([^"]+)"/)) !== null) {
        words.push(m[1]);
        ss = ss.substring(0, m.index) + ss.substring(m.index + m[0].length);
      }
      ss = ss.trim();
      if (ss.length) words = words.concat(ss.split(/\s+/));

      for (let k = 0; k < this.items.length; k++) {
        const item = this.items[k];
        item.found = false;
        if (!words.length) continue;

        let word_found = true;
        let matchingValues = {};

        for (let i = 0; i < words.length; i++) {
          let ok = false;
          const w = words[i];
          matchingValues[w] = {};
          for (let j = 0; j < columns.length; j++) {
            const values = item.values();
            const col = columns[j];
            if (Object.prototype.hasOwnProperty.call(values, col) && values[col] != null) {
              const text = (typeof values[col] !== 'string') ? values[col].toString() : values[col];
              if (text.toLowerCase().indexOf(w) !== -1) {
                ok = true;
                if (this.searchInfos) {
                  matchingValues[w][col] = matchingValues[w][col] ?? [];
                  matchingValues[w][col].push(text);
                }
                if (!this.searchInfos) break;
              }
            }
          }
          if (!ok) { word_found = false; break; }
        }
        item.found = word_found;
        item.matchingValues = this.searchInfos ? matchingValues : undefined;
      }
    };

    const searchMethod = (str, maybeCols, maybeFn) => {
      this.trigger('searchStart');
      prepare.resetList();

      const opts = prepare.setOptions(arguments);
      const custom = opts.customSearch || maybeFn;
      const columns = prepare.setColumns(opts.columns ?? maybeCols);
      const ss = prepare.normalize(str);

      if (ss === '') {
        this.reset.search();
        this.searched = false;
      } else {
        this.searched = true;
        if (custom) custom(ss, columns);
        else runListSearch(ss, columns);
      }

      this.update();
      this.trigger('searchComplete');
      return this.visibleItems;
    };

    this.handlers.searchStart = this.handlers.searchStart || [];
    this.handlers.searchComplete = this.handlers.searchComplete || [];

    // Bind inputs in container
    this.utils.events.bind(
      this.utils.getByClass(this.listContainer, this.searchClass),
      'keyup',
      this.utils.events.debounce(e => {
        const target = e.target || e.srcElement;
        const alreadyCleared = target.value === '' && !this.searched;
        if (!alreadyCleared) searchMethod(target.value);
      }, this.searchDelay)
    );
    this.utils.events.bind(
      this.utils.getByClass(this.listContainer, this.searchClass),
      'input',
      e => { const t = e.target || e.srcElement; if (t.value === '') searchMethod(''); }
    );

    this.search = searchMethod;
  }

  _buildFilter () {
    this.handlers.filterStart = this.handlers.filterStart || [];
    this.handlers.filterComplete = this.handlers.filterComplete || [];

    this.filter = fn => {
      this.trigger('filterStart');
      this.i = 1;
      this.reset.filter();

      if (fn === undefined) {
        this.filtered = false;
      } else {
        this.filtered = true;
        for (let i = 0; i < this.items.length; i++) {
          const item = this.items[i];
          item.filtered = !!fn(item);
        }
      }

      this.update();
      this.trigger('filterComplete');
      return this.visibleItems;
    };
  }

  _buildSort () {
    const buttons = {
      els: this.utils.getByClass(this.listContainer, this.sortClass),
      clear: () => {
        const els = buttons.els || [];
        for (let i = 0; i < els.length; i++) {
          this.utils.classes(els[i]).remove('asc');
          this.utils.classes(els[i]).remove('desc');
        }
      },
      getOrder: btn => {
        const predefined = this.utils.getAttribute(btn, 'data-order');
        if (predefined === 'asc' || predefined === 'desc') return predefined;
        if (this.utils.classes(btn).has('desc')) return 'asc';
        if (this.utils.classes(btn).has('asc')) return 'desc';
        return 'asc';
      },
      setOrder: opts => {
        const els = buttons.els || [];
        for (let i = 0; i < els.length; i++) {
          const btn = els[i];
          if (this.utils.getAttribute(btn, 'data-sort') !== opts.valueName) continue;
          const predefined = this.utils.getAttribute(btn, 'data-order');
          if (predefined === 'asc' || predefined === 'desc') {
            if (predefined === opts.order) this.utils.classes(btn).add(opts.order);
          } else {
            this.utils.classes(btn).add(opts.order);
          }
        }
      },
      setInsensitive: (btn, opts) => {
        const ins = this.utils.getAttribute(btn, 'data-insensitive');
        opts.insensitive = (ins === 'false') ? false : true;
      }
    };

    const sort = (...args) => {
      this.trigger('sortStart');
      let options = {};
      const target = args[0]?.currentTarget || args[0]?.srcElement || undefined;

      if (target) {
        options.valueName = this.utils.getAttribute(target, 'data-sort');
        buttons.setInsensitive(target, options);
        options.order = buttons.getOrder(target);
      } else {
        options = args[1] || {};
        options.valueName = args[0];
        options.order = options.order || 'asc';
        options.insensitive = (typeof options.insensitive === 'undefined') ? true : options.insensitive;
      }

      buttons.clear();
      buttons.setOrder(options);

      const custom = options.sortFunction || this.sortFunction || null;
      const multi = options.order === 'desc' ? -1 : 1;
      let sorter;

      if (custom) {
        sorter = (a, b) => custom(a, b, options) * multi;
      } else {
        sorter = (a, b) => {
          let sort = this.utils.naturalSort;
          sort.alphabet = this.alphabet || options.alphabet || undefined;
          if (!sort.alphabet && options.insensitive) {
            sort = this.utils.naturalSort.caseInsensitive;
          }
          return sort(a.values()[options.valueName], b.values()[options.valueName]) * multi;
        };
      }

      this.items.sort(sorter);
      this.update();
      this.trigger('sortComplete');
    };

    this.handlers.sortStart = this.handlers.sortStart || [];
    this.handlers.sortComplete = this.handlers.sortComplete || [];
    this.utils.events.bind(buttons.els, 'click', sort);
    this.on('searchStart', buttons.clear);
    this.on('filterStart', buttons.clear);
    this.sort = sort;
  }

  _buildFuzzySearch (opts = {}) {
    const options = this.utils.extend({
      location: 0,
      distance: 100,
      threshold: 0.4,
      multiSearch: true,
      searchClass: 'fuzzy-search'
    }, opts || {});
    const fuzzy = ListJS._fuzzy;

    const fuzzySearch = {
      search: (searchString, columns) => {
        const searchArguments = options.multiSearch
          ? searchString.replace(/ +$/, '').split(/ +/)
          : [ searchString ];
        for (let k = 0; k < this.items.length; k++) {
          fuzzySearch.item(this.items[k], columns, searchArguments);
        }
      },
      item: (item, columns, searchArgs) => {
        let found = true;
        for (let i = 0; i < searchArgs.length; i++) {
          let ok = false;
          for (let j = 0; j < columns.length; j++) {
            if (fuzzySearch.values(item.values(), columns[j], searchArgs[i])) ok = true;
          }
          if (!ok) found = false;
        }
        item.found = found;
      },
      values: (values, key, term) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          const text = ListJS._toString(values[key]).toLowerCase();
          if (fuzzy(text, term, options)) return true;
        }
        return false;
      }
    };

    // Bind fuzzy inputs
    this.utils.events.bind(
      this.utils.getByClass(this.listContainer, options.searchClass),
      'keyup',
      this.utils.events.debounce(e => {
        const target = e.target || e.srcElement;
        this.search(target.value, fuzzySearch.search);
      }, this.searchDelay)
    );

    // public entry: list.fuzzySearch(str, columns?)
    this.fuzzySearch = (str, columns) => this.search(str, columns, fuzzySearch.search);
  }

  _initPagination (options) {
    // Builds a tiny internal ListJS for the paging UI and wires click handlers
    const pagingList = new ListJS(this.listContainer.id, {
      listClass: options.paginationClass || 'pagination',
      item: options.item || '<li><a class=\'page\' href=\'#\'></a></li>',
      valueNames: [ 'page', 'dotted' ],
      searchClass: 'pagination-search-that-is-not-supposed-to-exist',
      sortClass: 'pagination-sort-that-is-not-supposed-to-exist'
    });

    const is = {
      number (i, left, right, currentPage, innerWindow) {
        return this.left(i, left) || this.right(i, right) || this.innerWindow(i, currentPage, innerWindow);
      },
      left (i, left) { return i <= left; },
      right (i, right) { return i > right; },
      innerWindow (i, currentPage, win) { return i >= currentPage - win && i <= currentPage + win; },
      dotted (pagingList, i, left, right, currentPage, innerWindow, currentIdx) {
        return this.dottedLeft(pagingList, i, left, right, currentPage, innerWindow) ||
               this.dottedRight(pagingList, i, left, right, currentPage, innerWindow, currentIdx);
      },
      dottedLeft (pagingList, i, left, right, currentPage, innerWindow) {
        return i === left + 1 && !this.innerWindow(i, currentPage, innerWindow) && !this.right(i, right);
      },
      dottedRight (pagingList, i, left, right, currentPage, innerWindow, currentIdx) {
        if (pagingList.items[currentIdx - 1]?.values().dotted) return false;
        return i === right && !this.innerWindow(i, currentPage, innerWindow) && !this.right(i, right);
      }
    };

    const refresh = () => {
      if (this.page < 1) {
        pagingList.listContainer.style.display = 'none';
        return;
      } else {
        pagingList.listContainer.style.display = 'block';
      }

      const l = this.matchingItems.length;
      const index = this.i;
      const page = this.page;
      const pages = Math.ceil(l / page) || 1;
      const currentPage = Math.ceil(index / page) || 1;
      const innerWindow = options.innerWindow || 2;
      const left = options.left || options.outerWindow || 0;
      let right = options.right || options.outerWindow || 0;
      right = pages - right;

      pagingList.clear();

      for (let i = 1; i <= pages; i++) {
        const isActive = (currentPage === i);
        if (is.number(i, left, right, currentPage, innerWindow)) {
          const item = pagingList.add({ page: i, dotted: false })[0];
          if (isActive) ListJS._classes(item.elm).add('active');
          item.elm.firstChild.setAttribute('data-i', i);
          item.elm.firstChild.setAttribute('data-page', page);
        } else if (is.dotted(pagingList, i, left, right, currentPage, innerWindow, pagingList.size())) {
          const item = pagingList.add({ page: '...', dotted: true })[0];
          ListJS._classes(item.elm).add('disabled');
        }
      }
    };

    this.utils.events.bind(pagingList.listContainer, 'click', e => {
      const tgt = e.target || e.srcElement;
      const page = this.utils.getAttribute(tgt, 'data-page');
      const i = this.utils.getAttribute(tgt, 'data-i');
      if (i) this.show((i - 1) * page + 1, page);
    });

    this.on('updated', refresh);
    refresh();
  }

  // ---------- Item (internal) ----------
  static _Item = class {
    constructor (list, initValues, element, notCreate) {
      this.list = list;
      this._values = {};
      this.found = false;
      this.filtered = false;

      const init = (initValues, element, notCreate) => {
        if (element === undefined) {
          if (notCreate) this.values(initValues, notCreate);
          else this.values(initValues);
        } else {
          this.elm = element;
          const values = list.templater.get(this, initValues);
          this.values(values);
        }
      };
      init(initValues, element, notCreate);
    }

    values (newValues, notCreate) {
      if (newValues !== undefined) {
        for (const name in newValues) this._values[name] = newValues[name];
        if (notCreate !== true) this.list.templater.set(this, this.values());
      } else {
        return this._values;
      }
    }

    show () { this.list.templater.show(this); }
    hide () { this.list.templater.hide(this); }

    matching () {
      const l = this.list;
      return (l.filtered && l.searched && this.found && this.filtered) ||
             (l.filtered && !l.searched && this.filtered) ||
             (!l.filtered && l.searched && this.found) ||
             (!l.filtered && !l.searched);
    }

    visible () {
      return this.elm && this.elm.parentNode === this.list.list;
    }
  };

  // ---------- Templater (internal) ----------
  static _Templater = class {
    constructor (list) {
      this.list = list;
      this._init();
    }

    _init () {
      const list = this.list;
      let createItem;

      const getItemSource = itemHTML => {
        if (typeof itemHTML !== 'string') return undefined;
        if (/<tr[\s>]/g.exec(itemHTML)) {
          const tbody = document.createElement('tbody');
          tbody.innerHTML = itemHTML;
          return tbody.firstElementChild;
        } else if (itemHTML.indexOf('<') !== -1) {
          const div = document.createElement('div');
          div.innerHTML = itemHTML;
          return div.firstElementChild;
        }
        return undefined;
      };

      const getFirstListItem = () => {
        const nodes = list.list.childNodes;
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].data === undefined) return nodes[i].cloneNode(true);
        }
        return undefined;
      };

      const createCleanTemplateItem = (templateNode, valueNames) => {
        const el = templateNode.cloneNode(true);
        el.removeAttribute('id');
        for (let i = 0; i < valueNames.length; i++) {
          let elm, valueName = valueNames[i];
          if (valueName.data) {
            for (let j = 0; j < valueName.data.length; j++) {
              el.setAttribute('data-' + valueName.data[j], '');
            }
          } else if (valueName.attr && valueName.name) {
            const listNodes = ListJS._getByClass(el, valueName.name, false);
            for (const node of listNodes) {
              if (node.getAttribute(valueName.attr) === '[attrBlocked]') {
                node.removeAttribute(valueName.attr);
                continue;
              }
              node.setAttribute(valueName.attr, '');
              if (valueName.prefix) node.setAttribute('prefix-' + valueName.name, valueName.prefix);
            }
          } else if (valueName.prop && valueName.name) {
            // untouched; property binding done in setValue
          } else if (valueName.class) {
            if (valueName.all) {
              const listNodes = ListJS._getByClass(el, valueName.class, false);
              for (const node of listNodes) if (node) node.innerHTML = '';
            } else {
              elm = ListJS._getByClass(el, valueName.class, true);
              if (elm) elm.innerHTML = '';
            }
          } else if (valueName.value) {
            const target = valueName.target ?? valueName.value;
            elm = ListJS._getByClass(el, target, true);
            if (elm) elm.innerHTML = '';
          } else {
            elm = ListJS._getByClass(el, valueName, true);
            if (elm) elm.innerHTML = '';
          }
        }
        return el;
      };

      let itemSource;
      if (typeof list.item === 'function') {
        createItem = values => getItemSource(list.item(values));
      } else if (typeof list.item === 'string') {
        itemSource = (list.item.indexOf('<') === -1) ? document.getElementById(list.item) : getItemSource(list.item);
      } else {
        itemSource = getFirstListItem();
      }
      if (!itemSource && typeof list.item !== 'function') {
        throw new Error('The list needs a template (initial item or string template).');
      }
      if (typeof list.item !== 'function') {
        itemSource = createCleanTemplateItem(itemSource, list.valueNames);
        createItem = () => itemSource.cloneNode(true);
      }

      this._createItem = createItem;
    }

    create (item) {
      if (item.elm !== undefined) return false;
      item.elm = this._createItem(item.values());
      this.set(item, item.values());
      return true;
    }

    remove (item) {
      if (item.elm?.parentNode === this.list.list) {
        this.list.list.removeChild(item.elm);
      }
    }

    show (item) {
      this.create(item);
      this._applyIterationPlaceholders(item);
      this.list.list.appendChild(item.elm);
    }

    hide (item) {
      if (item.elm && item.elm.parentNode === this.list.list) {
        this.list.list.removeChild(item.elm);
      }
    }

    clear () {
      const root = this.list.list;
      while (root.firstChild) root.removeChild(root.firstChild);
    }

    get (item, valueNames) {
      this.create(item);
      const values = {};
      for (let i = 0; i < valueNames.length; i++) {
        let elm, valueName = valueNames[i];
        if (valueName.data) {
          for (let j = 0; j < valueName.data.length; j++) {
            values[valueName.data[j]] = ListJS._getAttribute(item.elm, 'data-' + valueName.data[j]);
          }
        } else if (valueName.attr && valueName.name) {
          elm = ListJS._getByClass(item.elm, valueName.name, true);
          values[valueName.name] = elm ? ListJS._getAttribute(elm, valueName.attr) : '';
        } else {
          elm = ListJS._getByClass(item.elm, valueName, true);
          values[valueName] = elm ? elm.innerHTML : '';
        }
      }
      return values;
    }

    rebuild (item) {
      const parent = item.elm?.parentNode, next = item.elm?.nextSibling;
      if (parent) parent.removeChild(item.elm);
      item.elm = undefined;
      this.create(item);
      if (parent && item.elm) parent.insertBefore(item.elm, next);
    }

    set (item, values) {
      if (!this.create(item)) {
        for (const v in values) if (Object.prototype.hasOwnProperty.call(values, v)) {
          this._setValue(item, v, values[v]);
        }
      }
      this._applyIterationPlaceholders(item);
    }

    _applyIterationPlaceholders (item) {
      const list = this.list;
      const placeholderValue = list.iterationPlaceholder;
      if (!item?.elm) return;
      const placeholder = typeof placeholderValue === 'string'
        ? placeholderValue
        : (placeholderValue != null ? String(placeholderValue) : '');
      if (!placeholder) return;

      const attrs = Array.isArray(list.iterationAttributes) && list.iterationAttributes.length
        ? list.iterationAttributes
        : [ 'id', 'for' ];

      const idx = list.items.indexOf(item);
      if (idx === -1) return;

      const offsetNumber = Number(list.iterationStart);
      const offset = Number.isNaN(offsetNumber) ? 0 : offsetNumber;

      const formatter = typeof list.iterationFormatter === 'function'
        ? list.iterationFormatter
        : ({ number, placeholder }) => {
          const leading = placeholder.match(/^[^a-zA-Z0-9]*/)?.[0] ?? '';
          const trailing = placeholder.match(/[^a-zA-Z0-9]*$/)?.[0] ?? '';
          return `${leading}${number}${trailing}`;
        };

      const nodes = [ item.elm ];
      if (typeof item.elm.querySelectorAll === 'function') {
        nodes.push(...item.elm.querySelectorAll('*'));
      }

      const buildValue = (templateValue, attr, element) => {
        const number = idx + offset;
        const value = formatter({
          index: idx,
          number,
          base: templateValue,
          placeholder,
          attr,
          element,
          item,
          list
        });
        return templateValue.split(placeholder).join(String(value ?? ''));
      };

      for (const node of nodes) {
        if (!node || typeof node.getAttribute !== 'function') continue;
        for (const attr of attrs) {
          if (!node.hasAttribute(attr)) continue;

          const baseKey = `data-listjs-iterate-template-${attr}`;
          let templateValue = node.getAttribute(baseKey);
          if (templateValue == null) {
            const rawValue = node.getAttribute(attr);
            if (rawValue == null || rawValue.indexOf(placeholder) === -1) continue;
            templateValue = rawValue;
            node.setAttribute(baseKey, templateValue);
          }
          if (templateValue.indexOf(placeholder) === -1) continue;

          node.setAttribute(attr, buildValue(templateValue, attr, node));
        }
      }
    }

    _setValue (item, name, value) {
      const list = this.list;

      const getValueName = (nm, offset) => {
        let offsetReached = !offset;
        for (let i = 0; i < list.valueNames.length; i++) {
          const vn = list.valueNames[i];
          if (offset && offset === vn) { offsetReached = true; continue; }
          if (!offsetReached) continue;

          if (vn.data) {
            for (let j = 0; j < vn.data.length; j++) if (vn.data[j] === nm) return { data: nm };
          } else if (vn.attr && vn.name && (vn.name === nm || vn.name.startsWith(nm + '*'))) {
            return vn;
          } else if (vn.class && vn.class === nm) {
            return vn;
          } else if (vn.value && vn.value === nm) {
            return vn;
          } else if (vn.prop && vn.name && vn.name === nm) {
            return vn;
          } else if (vn === nm) {
            return nm;
          }
        }
      };

      let valueName;
      while ((valueName = getValueName(name, valueName)) != null) {
        if (valueName.data) {
          item.elm.setAttribute('data-' + valueName.data, value);
        } else if (valueName.attr && valueName.name) {
          const listNodes = ListJS._getByClass(item.elm, valueName.name, false);
          for (const elm of listNodes) {
            if (elm.getAttribute(valueName.attr) !== '') continue;
            elm.setAttribute(valueName.attr, (valueName.prefix ?? '') + value);
          }
        } else if (valueName.prop && valueName.name) {
          const elm = ListJS._getByClass(item.elm, valueName.name, true);
          if (elm) {
            switch (valueName.prop) {
            case 'checked':  elm.checked  = (value === true || value == 1); break;
            case 'disabled': elm.disabled = (value === true || value == 1); break;
            }
          }
        } else if (valueName.class) {
          if (valueName.all) {
            const listNodes = ListJS._getByClass(item.elm, valueName.class, false);
            for (const elm of listNodes) if (elm) elm.innerHTML = value;
          } else {
            const elm = ListJS._getByClass(item.elm, valueName.class, true);
            if (elm) elm.innerHTML = value;
          }
        } else if (valueName.value) {
          const target = valueName.target ?? valueName.value;
          const elm = ListJS._getByClass(item.elm, target, true);
          if (elm) elm.value = value;
        } else {
          const elm = ListJS._getByClass(item.elm, valueName, true);
          if (elm) elm.innerHTML = value;
        }
      }
    }
  };

  // ---------- Utils (static) ----------
  static _indexOf (arr, obj) {
    if (Array.prototype.indexOf) return arr.indexOf(obj);
    for (let i = 0; i < arr.length; ++i) if (arr[i] === obj) return i;
    return -1;
  }

  static _toArray (collection) {
    if (typeof collection === 'undefined') return [];
    if (collection === null) return [ null ];
    if (collection === window) return [ window ];
    if (typeof collection === 'string') return [ collection ];
    if (Object.prototype.toString.call(collection) === '[object Array]') return collection;
    if (typeof collection.length !== 'number') return [ collection ];
    if (typeof collection === 'function') return [ collection ];
    const arr = [];
    for (let i = 0; i < collection.length; i++) {
      if (Object.prototype.hasOwnProperty.call(collection, i) || i in collection) arr.push(collection[i]);
    }
    return arr.length ? arr : [];
  }

  static _getByClass (container, className, single, options = {}) {
    if ((options.test && options.getElementsByClassName) || (!options.test && document.getElementsByClassName)) {
      return single ? container.getElementsByClassName(className)[0] : container.getElementsByClassName(className);
    } else if ((options.test && options.querySelector) || (!options.test && document.querySelector)) {
      const sel = '.' + className;
      return single ? container.querySelector(sel) : container.querySelectorAll(sel);
    } else {
      // Polyfill
      const classElements = [];
      const els = container.getElementsByTagName('*');
      const pattern = new RegExp('(^|\\s)' + className + '(\\s|$)');
      for (let i = 0, j = 0; i < els.length; i++) {
        if (pattern.test(els[i].className)) {
          if (single) return els[i];
          classElements[j++] = els[i];
        }
      }
      return classElements;
    }
  }

  static _getAttribute (el, attr) {
    let result = (el.getAttribute && el.getAttribute(attr)) || null;
    if (!result) {
      const attrs = el.attributes;
      for (let i = 0; i < attrs.length; i++) {
        if (attrs[i] && attrs[i].nodeName === attr) result = attrs[i].nodeValue;
      }
    }
    return result;
  }

  static _extend (obj, ...rest) {
    rest.forEach(src => {
      if (!src) return;
      for (const k in src) obj[k] = src[k];
    });
    return obj;
  }

  static _toString (s) {
    s = (s === undefined || s === null) ? '' : s;
    return s.toString();
  }

  static _getByPath (obj, path) {
    if (!obj || !path) return undefined;
    if (typeof path !== 'string' || path.indexOf('.') === -1) return obj[path];
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  static _createElementFromHTML (html) {
    if (typeof html !== 'string') return undefined;
    if (/<tr[\s>]/g.exec(html)) {
      const tbody = document.createElement('tbody');
      tbody.innerHTML = html;
      return tbody.firstElementChild;
    }
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.firstElementChild;
  }

  static _coerceGroupNode (input, tag, info) {
    if (input && input.nodeType) return input.cloneNode(true);
    if (input === undefined || input === null) return null;
    const str = ListJS._toString(input).replace(/\{\{label\}\}/g, ListJS._toString(info.label));
    if (str.indexOf('<') !== -1) return ListJS._createElementFromHTML(str);
    const node = document.createElement(tag || 'li');
    node.textContent = str;
    return node;
  }

  static _normalizeGroupBy (groupBy) {
    if (!groupBy) return [];
    const list = Array.isArray(groupBy) ? groupBy : [ groupBy ];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const cfg = list[i] || {};
      const name = cfg.name || cfg.valueName;
      if (!name && typeof cfg.name !== 'function') continue;
      out.push({
        name: cfg.name || cfg.valueName,
        groups: ListJS._normalizeGroupFilters(cfg.filter || cfg.groups),
        headerTag: cfg.headerTag || cfg.tag,
        headerClass: (typeof cfg.headerClass !== 'undefined') ? cfg.headerClass : 'listjs-group',
        header: cfg.header,
        fallback: cfg.fallback,
        weekStartsOn: (typeof cfg.weekStartsOn === 'number') ? cfg.weekStartsOn : 1
      });
    }
    return out;
  }

  static _normalizeGroupFilters (filter) {
    if (!filter) return [];
    const groups = [];
    if (Array.isArray(filter)) {
      for (let i = 0; i < filter.length; i++) {
        const def = ListJS._normalizeGroupDef(filter[i], i);
        if (def) groups.push(def);
      }
    } else if (typeof filter === 'object') {
      const keys = Object.keys(filter);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const def = ListJS._normalizeGroupDef(filter[key], key);
        if (def) groups.push(def);
      }
    }
    return groups;
  }

  static _normalizeGroupDef (def, key) {
    let id = key;
    let label;
    let test;

    if (typeof def === 'function') {
      test = def;
      label = ListJS._toString(key);
    } else if (typeof def === 'string') {
      label = def;
    } else if (def && typeof def === 'object') {
      id = def.id || def.name || key;
      label = def.label || def.title || def.text || def.name || id;
      test = def.test || def.filter || def.match;
    } else if (def !== undefined && def !== null) {
      label = ListJS._toString(def);
    } else {
      return null;
    }

    if (!id) id = label;
    const builtIn = ListJS._groupDateTests[id];
    if (!test && builtIn) test = ListJS._wrapDateTest(builtIn);
    if (!test) test = value => value == id;

    return {
      id,
      label: (label !== undefined && label !== null) ? ListJS._toString(label) : ListJS._toString(id),
      test
    };
  }

  static _wrapDateTest (fn) {
    return (value, item, list, ctx) => {
      const date = ListJS._parseDate(value);
      if (!date) return false;
      const now = ctx?.now || new Date();
      const weekStartsOn = (ctx && typeof ctx.weekStartsOn === 'number') ? ctx.weekStartsOn : 1;
      return fn(date, now, weekStartsOn);
    };
  }

  static _parseDate (value) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  static _startOfDay (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  static _startOfWeek (date, weekStartsOn) {
    const start = ListJS._startOfDay(date);
    const day = start.getDay();
    const offset = (day - weekStartsOn + 7) % 7;
    start.setDate(start.getDate() - offset);
    return start;
  }

  static _isSameDay (a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  static _events = {
    bind (el, type, fn, capture) {
      const list = ListJS._toArray(el);
      const bind = window.addEventListener ? 'addEventListener' : 'attachEvent';
      const prefix = (bind !== 'addEventListener') ? 'on' : '';
      for (let i = 0; i < list.length; i++) {
        list[i][bind](prefix + type, fn, capture || false);
      }
    },
    unbind (el, type, fn, capture) {
      const list = ListJS._toArray(el);
      const unbind = window.removeEventListener ? 'removeEventListener' : 'detachEvent';
      const prefix = (unbind !== 'removeEventListener') ? 'on' : '';
      for (let i = 0; i < list.length; i++) {
        list[i][unbind](prefix + type, fn, capture || false);
      }
    },
    debounce (fn, wait, immediate) {
      let timeout;
      return wait ? function debounced (...args) {
        const context = this;
        const later = () => { timeout = null; if (!immediate) fn.apply(context, args); };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) fn.apply(context, args);
      } : fn;
    }
  };

  static _classes (el) {
    if (!el || !el.nodeType) throw new Error('A DOM element reference is required');
    const list = el.classList;
    const api = {
      add (name)   { if (list) list.add(name);   else _fallback(true, name);  return api; },
      remove (name){ if (list) list.remove(name);else _fallback(false, name); return api; },
      toggle (name, force) {
        if (list) {
          if (typeof force !== 'undefined') {
            if (force !== list.toggle(name, force)) list.toggle(name);
          } else list.toggle(name);
          return api;
        }
        if (typeof force !== 'undefined') force ? api.add(name) : api.remove(name);
        else (api.has(name) ? api.remove(name) : api.add(name));
        return api;
      },
      has (name){ return list ? list.contains(name) : !!~ListJS._indexOf(api.array(), name); },
      array (){
        const className = el.getAttribute('class') || '';
        const str = className.replace(/^\s+|\s+$/g, '');
        const arr = str.split(/\s+/);
        if (arr[0] === '') arr.shift();
        return arr;
      }
    };
    function _fallback (add, name) {
      const arr = api.array();
      const i = ListJS._indexOf(arr, name);
      if (add && !~i) arr.push(name);
      if (!add && ~i) arr.splice(i, 1);
      el.className = arr.join(' ');
    }
    return api;
  }

  static _groupDateTests = {
    today (date, now) {
      return ListJS._isSameDay(date, now);
    },
    yesterday (date, now) {
      const startToday = ListJS._startOfDay(now);
      const startYesterday = new Date(startToday);
      startYesterday.setDate(startYesterday.getDate() - 1);
      return date >= startYesterday && date < startToday;
    },
    thisWeek (date, now, weekStartsOn) {
      const startWeek = ListJS._startOfWeek(now, weekStartsOn);
      const endWeek = new Date(startWeek);
      endWeek.setDate(endWeek.getDate() + 7);
      return date >= startWeek && date < endWeek;
    },
    thisMonth (date, now) {
      return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
    },
    thisYear (date, now) {
      return date.getFullYear() === now.getFullYear();
    },
    lastYear (date, now) {
      return date.getFullYear() === now.getFullYear() - 1;
    },
    older (date, now) {
      return date.getFullYear() < now.getFullYear() - 1;
    }
  };

  // Natural sort with caseInsensitive variant
  static _naturalSort (a, b) {
    const cmp = ListJS._naturalCompare('' + a, '' + b);
    return cmp;
  }
  static _naturalCompare (a, b) {
    const isNum = c => c >= 48 && c <= 57;
    let i = 0, j = 0;
    const la = (a += '').length, lb = (b += '').length;

    while (i < la && j < lb) {
      let ca = a.charCodeAt(i), cb = b.charCodeAt(j);
      if (isNum(ca)) {
        if (!isNum(cb)) return ca - cb;
        let sa = i, sb = j;
        while (a.charCodeAt(sa) === 48 && ++sa < la) { /* empty */ }
        while (b.charCodeAt(sb) === 48 && ++sb < lb) { /* empty */ }
        let ea = sa, eb = sb;
        while (ea < la && isNum(a.charCodeAt(ea))) ea++;
        while (eb < lb && isNum(b.charCodeAt(eb))) eb++;
        const diff = (ea - sa) - (eb - sb);
        if (diff) return diff;
        while (sa < ea) {
          const d = a.charCodeAt(sa++) - b.charCodeAt(sb++);
          if (d) return d;
        }
        i = ea; j = eb; continue;
      }
      if (ca !== cb) return ca - cb;
      i++; j++;
    }
    if (i >= la && j < lb && la >= lb) return -1;
    if (j >= lb && i < la && lb >= la) return 1;
    return la - lb;
  }
}
ListJS._naturalSort.caseInsensitive = (a, b) => ListJS._naturalSort(('' + a).toLowerCase(), ('' + b).toLowerCase());

// Fuzzy (Bitap)
ListJS._fuzzy = function (text, pattern, options) {
  const loc = options.location || 0;
  const dist = options.distance || 100;
  let threshold = options.threshold || 0.4;
  if (pattern === text) return true;
  if (pattern.length > 32) return false;
  const s = (() => {
    const q = {};
    for (let i = 0; i < pattern.length; i++) q[pattern.charAt(i)] = 0;
    for (let i = 0; i < pattern.length; i++) q[pattern.charAt(i)] |= 1 << (pattern.length - i - 1);
    return q;
  })();
  function score (e, x) {
    const accuracy = e / pattern.length;
    const proximity = Math.abs(loc - x);
    if (!dist) return proximity ? 1.0 : accuracy;
    return accuracy + proximity / dist;
  }
  let best = text.indexOf(pattern, loc);
  if (best !== -1) {
    threshold = Math.min(score(0, best), threshold);
    best = text.lastIndexOf(pattern, loc + pattern.length);
    if (best !== -1) threshold = Math.min(score(0, best), threshold);
  }
  const matchmask = 1 << (pattern.length - 1);
  best = -1;
  let bin_max = pattern.length + text.length;
  let last_rd;

  for (let d = 0; d < pattern.length; d++) {
    let bin_min = 0, bin_mid = bin_max;
    while (bin_min < bin_mid) {
      if (score(d, loc + bin_mid) <= threshold) bin_min = bin_mid;
      else bin_max = bin_mid;
      bin_mid = Math.floor((bin_max - bin_min) / 2 + bin_min);
    }
    bin_max = bin_mid;
    let start = Math.max(1, loc - bin_mid + 1);
    const finish = Math.min(loc + bin_mid, text.length) + pattern.length;
    const rd = Array(finish + 2);
    rd[finish + 1] = (1 << d) - 1;

    for (let j = finish; j >= start; j--) {
      const charMatch = s[text.charAt(j - 1)];
      if (d === 0) rd[j] = ((rd[j + 1] << 1) | 1) & charMatch;
      else rd[j] = (((rd[j + 1] << 1) | 1) & charMatch) | (((last_rd[j + 1] | last_rd[j]) << 1) | 1) | last_rd[j + 1];

      if (rd[j] & matchmask) {
        const sc = score(d, j - 1);
        if (sc <= threshold) {
          threshold = sc;
          best = j - 1;
          if (best > loc) start = Math.max(1, 2 * loc - best);
          else break;
        }
      }
    }
    if (score(d + 1, loc) > threshold) break;
    last_rd = rd;
  }
  return best < 0 ? false : true;
};

// Expose globally if desired:
// window.ListJS = ListJS;
// export default ListJS;
