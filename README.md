# ListJS (Standalone ES Class)

Kleine, framework-unabhängige Liste mit Suche, Filter, Sortierung, Pagination und optionaler Fuzzy-Suche.
Direkt im Browser nutzbar, ohne Bundler oder module.exports.

## Schnellstart

Einfach `List.js` einbinden und eine Container-Struktur bereitstellen:

```html
<div id="users">
  <input class="search" placeholder="Suche..." />
  <button class="sort" data-sort="name">Sortiere nach Name</button>
  <ul class="list">
    <li>
      <span class="name"></span>
      <span class="email"></span>
    </li>
  </ul>
  <ul class="pagination"></ul>
</div>

<script src="List.js"></script>
<script>
  const options = {
    valueNames: [ 'name', 'email' ],
    page: 5,
    pagination: { paginationClass: 'pagination' }
  };

  const users = new ListJS('users', options, [
    { name: 'Ada', email: 'ada@example.com' },
    { name: 'Linus', email: 'linus@example.com' }
  ]);
</script>
```

Hinweis: In klassischen Script-Tags ist `ListJS` global verfügbar. Wenn du es explizit
am `window` oder als ES-Module exportieren willst, kannst du die auskommentierten
Zeilen am Ende von `List.js` aktivieren.

## HTML-Struktur

- Container-Element mit `id` (oder direkt als DOM-Element übergeben).
- Kind-Element mit Klasse `listClass` (default: `list`), darin Listeneinträge.
- Optional: Eingabefeld mit Klasse `searchClass` (default: `search`).
- Optional: Sort-Buttons/Links mit Klasse `sortClass` (default: `sort`) und `data-sort`.

## Optionen (Auszug)

Alle Optionen werden auf die Instanz gemerged. Wichtige Optionen:

- `listClass` (default: `list`) – CSS-Klasse für die Liste.
- `searchClass` (default: `search`) – CSS-Klasse für Sucheingaben.
- `sortClass` (default: `sort`) – CSS-Klasse für Sort-Buttons.
- `valueNames` (default: `[]`) – Definiert, welche Werte in Items gebunden werden.
- `item` – Template für Items: String (HTML), DOM-Id oder Funktion `(values) => html`.
- `page` (default: `10000`) – Anzahl Items pro Seite.
- `indexAsync` (default: `false`) – Listenelemente asynchron indizieren.
- `searchDelay` (default: `0`) – Debounce in ms für Sucheingaben.
- `searchColumns` (default: `undefined`) – Spalten für Suche, falls nicht aus `valueNames`.
- `searchInfos` (default: `0`) – Wenn truthy, füllt `item.matchingValues`.
- `sortFunction` – Custom Sortierfunktion `(a, b, options) => number`.
- `alphabet` – Alphabet für natürliche Sortierung.
- `pagination` – Objekt oder Array von Objekten für Pagination-UI.
- `fuzzySearch` – Optionen für die Fuzzy-Suche (siehe unten).
- `iterationPlaceholder` (default: `_iterate`) – Platzhalter für Attribute (siehe unten).
- `iterationAttributes` (default: `[ 'id', 'for' ]`) – Attribute mit Platzhalter.
- `iterationStart` (default: `0`) – Offset für Nummerierung.
- `iterationFormatter` – Funktion zur Erzeugung des Attributwerts.
- `groupBy` – Gruppierung mit Zwischenüberschriften (siehe unten).

### valueNames Varianten

`valueNames` bestimmt, wie Werte auf das DOM-Template gemappt werden. Der Key im
Werteobjekt muss zum Eintrag in `valueNames` passen. `valueNames` kann Strings
oder Objekte enthalten:

```js
valueNames: [
  'name',
  { data: [ 'id', 'role' ] },
  { name: 'link', attr: 'href', prefix: 'mailto:' },
  { class: 'title' },
  { value: 'inputValue' },
  { prop: 'checked', name: 'isActive' }
]
```

Details:
- String wie `'name'` setzt `innerHTML` des ersten Elements mit Klasse `.name`.
- `{ class: 'title' }` ist wie der String, mit `{ all: true }` werden alle `.title` gesetzt.
- `{ data: [ 'id', 'role' ] }` setzt `data-id` und `data-role` am Item-Root.
- `data` kann auch Objekte enthalten, z. B. `{ data: [ { name: 'isRead', fn: v => (v ? 1 : 0) } ] }`.
- `{ name: 'link', attr: 'href', prefix: 'mailto:' }` setzt `href` auf `.link` und
  hängt optional `prefix` vor den Wert.
- `{ value: 'inputValue' }` setzt `element.value` auf dem Element mit Klasse `.inputValue`.
  Mit `{ target: 'my-input' }` kannst du eine andere Klasse als Ziel angeben.
- `{ prop: 'checked', name: 'isActive' }` setzt eine DOM-Property (`checked`/`disabled`)
  auf dem Element mit Klasse `.isActive`.
- Optional kannst du pro Eintrag eine Transform-Funktion angeben:
  `{ class: 'preview', fn: (value) => value.substring(0, 100) }`.
  Alternativ: `{ class: 'preview', fn: 'substring', params: [ 0, 100 ] }`.
  Mit `alt` kannst du auf einen anderen Key fallbacken, falls der Wert leer ist
  (funktioniert auch ohne `fn`):
  `{ class: 'preview', fn: 'substring', params: [ 0, 100 ], alt: 'content' }`.
  `alt` greift auch dann, wenn der Ziel-Key nicht existiert - ideal für Derived-Felder:
  `{ class: 'avatar-initials', alt: 'fromName' }`.
- Mit `concat` kannst du Werte aus mehreren Keys zusammenbauen:
  `{ class: 'title', concat: { list: [ 'name', 'zuname' ], as: 'title' } }`.
  Mit Attributen z. B.:
  `{ name: 'link', attr: 'href', prefix: 'mailto:', concat: { list: [ 'name', 'zuname' ], as: 'link' } }`.
  `list` unterstützt Keys (auch verschachtelt wie `'from.name'`), `separator`/`sep`
  (default: Leerzeichen), `as` für einen zusätzlichen Alias-Key, `force: true` um
  auch vorhandene Zielwerte zu überschreiben.
  Beispiel mit `fn`+`alt`:
  `{ class: 'avatar-initials', alt: 'fullname', fn: (v) => CRM.tools.getInitials(v), concat: { list: [ 'name', 'zuname' ], as: 'fullname' } }`.
- Verschachtelte Daten (z. B. `from.name`) solltest du vor dem `add()` flatten,
  z. B. `{ fromName: mail.from.name }` und dann `valueNames: [ 'fromName' ]`.
- `reIndex()`/`get()` lesen nur `data`, `attr` und `innerHTML`; `value`/`prop` sind
  write-only beim Setzen.

## Iterationen (Loops)

Mit `loop` kannst du Arrays im Item rendern. Dazu wird das erste Element mit der
Loop-Klasse als Template geklont und pro Array-Eintrag eingefügt.

```html
<div class="comm-item-labels">
  <span class="labels"></span>
</div>
```

```js
valueNames: [
  { loop: 'labels', valueNames: [ 'identifier', { data: [ 'id' ] } ] }
]
```

```js
{
  labels: [
    { identifier: 'A', id: 0 },
    { identifier: 'B', id: 1 }
  ]
}
```

Ergebnis:
```html
<div class="comm-item-labels">
  <span class="labels" data-id="0">A</span>
  <span class="labels" data-id="1">B</span>
</div>
```

Auch Arrays aus Strings werden unterstützt:
```js
{ labels: [ 'A', 'B' ] }
```

```html
<div class="comm-item-labels">
  <span class="labels">A</span>
  <span class="labels">B</span>
</div>
```

Hinweise:
- `loop` kann auch als eigene Option `loops`/`loop` übergeben werden.
- Wenn kein passendes Element gefunden wird, wird der Loop übersprungen.
- `fn`, `params`, `alt` und `concat` funktionieren auch in Loop-`valueNames`.

## API (Public)

- `new ListJS(containerOrId, options = {}, values?)`
- `add(values, callback?)` – Fügt Werte hinzu; optional async per Callback (Chunks).
- `remove(valueName, value, options?)` – Entfernt Items nach Wert.
- `get(valueName, value)` – Gibt Items als Array zurück.
- `size()` – Anzahl Items.
- `clear()` – Entfernt alle Items aus DOM und Liste.
- `show(i, page)` – Zeigt ab Index `i` (1-based) `page` Items.
- `reIndex()` – List-Items aus DOM neu einlesen.
- `toJSON()` – Werte aller Items als Array.
- `search(str, columns?, customSearch?)` – Suche (unterstützt "quoted phrases").
- `filter(fn?)` – Filterfunktion; `undefined` setzt Filter zurück.
- `sort(valueName | event, options?)` – Sortierung, auch per Click-Handler.
- `update()` – Rendert den aktuellen Zustand.
- `on(event, callback)` / `off(event, callback)`
- `fuzzySearch(str, columns?)` – Fuzzy-Suche (wenn aktiviert).
- `reset.search()` / `reset.filter()` – setzt nur Search/Filter-Flags zurück.

## Events

Registriere Listener mit `list.on(event, fn)`:

- `updated`
- `searchStart`, `searchComplete`
- `filterStart`, `filterComplete`
- `sortStart`, `sortComplete`
- `parseComplete`

Jeder Listener erhält die Instanz als Argument.

## Pagination

Pagination wird über `options.pagination` aktiviert:

```js
const list = new ListJS('users', {
  valueNames: [ 'name' ],
  page: 10,
  pagination: { paginationClass: 'pagination', innerWindow: 2, left: 1, right: 1 }
});
```

Die Pagination nutzt intern eine kleine ListJS-Instanz und erwartet ein Element mit
Klasse `pagination` im Container.

## Fuzzy-Suche

Aktivierbar über `fuzzySearch`:

```js
const list = new ListJS('users', {
  valueNames: [ 'name' ],
  fuzzySearch: {
    searchClass: 'fuzzy-search',
    threshold: 0.4,
    distance: 100,
    multiSearch: true
  }
});
```

Ein Input mit Klasse `fuzzy-search` triggert dann `list.fuzzySearch()`.

## Gruppierung (Zwischenüberschriften)

Mit `groupBy` kannst du Items nach einem Feld gruppieren. Die Gruppen werden als
Überschriften zwischen den Items gerendert.

```js
const list = new ListJS('inbox', {
  valueNames: [ 'subject', 'createdAt' ],
  groupBy: [{
    name: 'createdAt',
    filter: {
      today: 'Heute',
      yesterday: 'Gestern',
      thisWeek: 'Diese Woche',
      thisMonth: 'Dieser Monat',
      thisYear: 'Dieses Jahr',
      lastYear: 'Letztes Jahr',
      older: 'Älter'
    },
    headerClass: 'listjs-group',
    weekStartsOn: 1
  }]
});

list.sort('createdAt', { order: 'desc' });
```

Hinweise:
- Die Filter-Keys `today`, `yesterday`, `thisWeek`, `thisMonth`, `thisYear`, `lastYear`,
  `older` sind eingebaute Datumsgruppen.
- Die Reihenfolge der Gruppen folgt der Reihenfolge im `filter`-Objekt.
- Standard-Header-Tag: `li` (UL/OL), `tr` (TBODY/THEAD/TFOOT), sonst `div`.
- `headerClass` kann mehrere Klassen enthalten (String mit Leerzeichen oder Array).
- Optional kannst du `header` als String, Funktion oder Template-ID setzen.
- `{{label}}`/`{{key}}` werden ersetzt (auch in Attributen). Bei Template-ID wird
  die `id` im Clone entfernt, um doppelte IDs zu vermeiden.

Beispiel mit Tabellen-Header:

```js
groupBy: [{
  name: 'createdAt',
  filter: { today: 'Heute', older: 'Älter' },
  header: ({ label }) => `<tr class="listjs-group"><td colspan="5">${label}</td></tr>`
}]
```

### Header-Template per ID + Klassen-Mapping

Wenn `{{label}}` wegen SSR (z.B. Smarty) kollidiert, kannst du stattdessen Klassen nutzen:

```html
<div id="group-header-template" class="listjs-group">
  <span class="title label"></span>
  <span class="meta key" data-key=""></span>
</div>
```

```js
groupBy: [{
  name: 'createdAt',
  header: 'group-header-template',
  labelClass: 'label', // Standard: "label"
  keyClass: 'key'      // Standard: "key" (setzt data-key)
}]
```

## Iteration Placeholder (IDs/for)

Wenn Attribute in den Templates den Platzhalter enthalten, wird er beim Rendern
automatisch ersetzt:

```html
<label for="user-_iterate">User</label>
<input id="user-_iterate" class="name" />
```

Mit `iterationStart` und `iterationFormatter` kannst du die Nummerierung steuern.

## Hinweise

- `searchColumns` bestimmt die Spalten für die Suche; ohne Angabe wird aus `valueNames`
  abgeleitet (falls Items existieren).
- `searchInfos` befüllt `item.matchingValues` mit Trefferdetails.
- `indexAsync` und `add(..., callback)` nutzen Chunking, um große Listen flüssig zu halten.
