# ListJS (Standalone ES Class)

Kleine, framework-unabhängige Liste mit Suche, Filter, Sortierung, Pagination, progressivem Lazy Loading und optionaler Fuzzy-Suche.
Direkt im Browser nutzbar, ohne Bundler oder module.exports.

## Herkunft und Lizenz

Dieses Projekt basiert auf [List.js von Jonny Strömberg (javve)](https://github.com/javve/list.js)
und wird von Sebastian Braesicke als eigenständige Variante weiterentwickelt.
Zu den Erweiterungen gehören unter anderem progressives Lazy Loading, zusätzliche
Methoden zur Item-Verwaltung und Gruppierung mit Zwischenüberschriften.

Der ursprüngliche Code und die Weiterentwicklungen stehen unter der [MIT-Lizenz](LICENSE).
Die Copyright-Hinweise des Ursprungsprojekts und für die eigenen Änderungen sind
in der Lizenzdatei enthalten.

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
- `lazyLoad` (default: `false`) – Objekt für progressives Rendering (siehe unten); nicht mit `pagination` kombinierbar.
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
  { class: 'title' [, all: true/false] },
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
- Für CSS-Klassen ergänzen (statt überschreiben):
  `{ name: 'icon', attr: 'class', classAttr: true }` auf z. B.
  `<i class="icon"></i>`.
  Dadurch bleiben bestehende Klassen erhalten und der neue Wert wird als zusätzliche
  Klasse(n) gesetzt.
- `{ value: 'inputValue' }` setzt `element.value` auf dem Element mit Klasse `.inputValue`.
  Mit `{ target: 'my-input' }` kannst du eine andere Klasse als Ziel angeben.
- `{ prop: 'checked', name: 'isActive' }` setzt eine DOM-Property (`checked`/`disabled`)
  auf dem Element mit Klasse `.isActive`.
- Optional kannst du pro Eintrag eine Transform-Funktion angeben:
  `{ class: 'preview', fn: (value) => value.substring(0, 100) }`.
  Alternativ: `{ class: 'preview', fn: 'substring', params: [ 0, 100 ] }`.
  Standard-Signatur ist `fn(value, item, list, valueName, ...)`. `item` ist dabei das ListJS-Item-Objekt.
  Wenn du das Item als ersten Parameter möchtest, nutze
  `fnArg: 'item'`, z. B.:
  `{ class: 'avatar-initials', fnArg: 'item', fn: (item) => CRM.tools.getInitials(item.cName) }`. Hier ist `item` jetzt das Werteobjekt.
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
- `prepend(values)` – Fügt ein Objekt oder Array am Anfang ein und erhält dabei die Reihenfolge des Arrays. Gibt die eingefügten Items als Array zurück, bei leerer Eingabe `undefined`.
- `remove(valueName, value, options?)` – Entfernt Items nach Wert.
- `removeBy(valueName, value, options?)` – Entfernt alle Treffer; gibt deren Anzahl zurück. Der sofortige Listenaufbau ist optional.
- `updateBy(valueName, value, newValues = {}, options = {})` – Ergänzt/überschreibt Werte des ersten Treffers; gibt das Item oder `null` zurück. Standardmäßig ohne vollständigen Listenaufbau.
- `upsert(valueName, value, newValues = {}, options = {})` – Aktualisiert den ersten Treffer oder fügt ein Item hinzu; gibt dieses Item zurück. Baut standardmäßig die Liste neu auf.
- `get(valueName, value)` – Gibt Items als Array zurück.
- `size()` – Anzahl Items.
- `clear()` – Entfernt alle Items aus DOM und Liste und leert auch `visibleItems` und `matchingItems`.
- `show(i, page)` – Zeigt ab Index `i` (1-based) `page` Items.
- `reIndex()` – List-Items aus DOM neu einlesen.
- `toJSON()` – Werte aller Items als Array.
- `search(str, columns?, customSearch?)` – Suche (unterstützt "quoted phrases").
- `filter(fn?)` – Filterfunktion; `undefined` setzt Filter zurück.
- `sort(valueName | event, options?)` – Sortierung, auch per Click-Handler.
- `update()` – Rendert den aktuellen Zustand.
- `loadMore(count?)` – Rendert den nächsten Lazy-Load-Block und gibt die neu sichtbaren Items als Array zurück; ohne aktives Lazy Loading oder weitere Treffer `[]`.
- `resetLazyLoad(options?)` – Setzt Lazy Loading auf die anfängliche Item-Anzahl zurück; gibt die Instanz zurück.
- `destroy()` – Trennt Lazy-Load-Observer, entfernt deren Scroll-/Resize-Listener und verwirft ausstehende Fallback-Prüfungen; gibt die Instanz zurück. Entfernt weder Items noch sonstige Such-/Sortier-Listener.
- `on(event, callback)` / `off(event, callback)`
- `fuzzySearch(str, columns?)` – Fuzzy-Suche (wenn aktiviert).
- `reset.search()` / `reset.filter()` – setzt nur Search/Filter-Flags zurück.

### Items gezielt ändern und positionieren

`updateBy`, `upsert` und `removeBy` suchen wie `get` per losem Vergleich (`==`).
`newValues` wird mit den vorhandenen Werten zusammengeführt; nicht angegebene Felder bleiben erhalten.
Beim Einfügen durch `upsert` muss der Suchschlüssel auch in `newValues` stehen:
Er wird nicht automatisch aus `valueName` und `value` übernommen.

```js
const users = new ListJS('users', {
  valueNames: [ 'name', 'email', { data: [ 'id' ] } ]
});

users.prepend([
  { id: 1, name: 'Ada', email: 'ada@example.com' },
  { id: 2, name: 'Linus', email: 'linus@example.com' }
]);

// Aktualisiert das einzelne Item ohne vollständigen Listenaufbau.
users.updateBy('id', 1, { email: 'ada@new.example.com' });

// Fügt ein Item ein oder aktualisiert es und verschiebt es an den Anfang.
users.upsert('id', 3, {
  id: 3, name: 'Grace', email: 'grace@example.com'
}, { position: 'start' });

// Mehrere Änderungen sammeln, anschließend einmal rendern.
users.updateBy('id', 1, { name: 'Ada Lovelace' }, { trigger: false });
users.removeBy('id', 2, { update: false, trigger: false });
users.update();
```

Optionen:

| Option | Verhalten |
| --- | --- |
| `update` | Vollständigen Listenaufbau ausführen. Default: `false` bei `updateBy`, `true` bei `upsert` und `removeBy`. |
| `trigger` | Ohne vollständigen Listenaufbau trotzdem `updated` auslösen (default: `true`). Bei `removeBy` nur, wenn etwas entfernt wurde. Mit Listenaufbau löst `update()` das Event unabhängig von dieser Option aus. |
| `notCreate` | Für `updateBy`/`upsert`: Mit `true` kein fehlendes DOM-Element vorzeitig erstellen. Bei Lazy Loading ist dies für noch nicht erstellte Items bzw. neue Upserts automatisch aktiv. Ein anschließendes `update()` erstellt sichtbare Items trotzdem. |
| `position` | Für `updateBy`/`upsert`: `'start'` oder `'end'` verschiebt das Item bzw. bestimmt seine Einfügeposition. |
| `index` | Für `updateBy`/`upsert`: Zielindex ab `0`, begrenzt auf den gültigen Bereich. `position` hat Vorrang. |
| `prepend` / `append` | Für `updateBy`/`upsert`: `true` als Kurzform für die Position am Anfang bzw. Ende. |

Ohne vollständigen Listenaufbau werden die sichtbare Reihenfolge, Gruppierung sowie
`visibleItems` und `matchingItems` nicht neu aufgebaut. Positionsänderungen werden erst
beim nächsten `update()` sichtbar; `removeBy` entfernt betroffene DOM-Elemente sofort.
Aktive Such-/Filterbedingungen und Sortierungen werden durch diese Methoden oder
`update()` nicht erneut ausgeführt. Bei relevanten Wertänderungen `search`, `filter`
bzw. `sort` erneut aufrufen.

## Events

Registriere Listener mit `list.on(event, fn)`:

- `updated`
- `searchStart`, `searchComplete`
- `filterStart`, `filterComplete`
- `sortStart`, `sortComplete`
- `parseComplete`
- `lazyLoadStart`, `lazyLoadComplete`, `lazyLoadExhausted`

Jeder Listener erhält die Instanz als erstes Argument. Lazy-Load-Events liefern
zusätzlich ein Detailobjekt als zweites Argument (siehe unten).

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

## Progressives Lazy Loading

Lazy Loading begrenzt zunächst die Anzahl gerenderter Items und erweitert sie beim
Scrollen blockweise. Alle übergebenen Daten bleiben im Speicher für Suche, Filter,
Sortierung, `get()`, `size()` und `toJSON()` verfügbar. Es werden keine Daten automatisch
vom Server geladen; bereits gerenderte Items bleiben beim Weiterscrollen im DOM.

```html
<div id="lazy-users">
  <input class="search" placeholder="Suche..." />
  <div class="scroll-area" style="max-height: 400px; overflow-y: auto;">
    <ul class="list"></ul>
  </div>
</div>
```

```js
const lazyUsers = new ListJS('lazy-users', {
  valueNames: [ 'name', 'email', { data: [ 'id' ] } ],
  item: '<li><span class="name"></span> <span class="email"></span></li>',
  lazyLoad: {
    mode: 'progressive',
    initialItems: 50,
    itemsPerLoad: 50,
    thresholdItems: 10,
    scrollContainer: '.scroll-area'
  }
});

// Hier die vollständigen, bereits geladenen Datensätze übergeben.
lazyUsers.add([
  { id: 1, name: 'Ada', email: 'ada@example.com' }
]);

lazyUsers.on('lazyLoadComplete', (list, detail) => {
  console.log(`${detail.renderedItems} von ${detail.matchingItems} gerendert`);
});

// Optional manuell, beispielsweise über einen Mehr-anzeigen-Button:
lazyUsers.loadMore();   // itemsPerLoad weitere Items
lazyUsers.loadMore(25); // bis zu 25 weitere Items
```

| Option | Default | Bedeutung |
| --- | --- | --- |
| `mode` | `'progressive'` | Einziger unterstützter Modus. |
| `initialItems` | `50` | Anfängliche Anzahl gerenderter Items. |
| `itemsPerLoad` | `50` | Anzahl zusätzlicher Items pro Block. |
| `thresholdItems` | `10` | Beobachtet das erste der letzten zehn sichtbaren Items; sobald es den Scrollbereich schneidet, wird erweitert. `0` beobachtet das letzte Item. |
| `scrollContainer` | automatisch | DOM-Element, CSS-Selektor, `window` oder `'window'`. Ohne Angabe wird ab der Liste der nächste Vorfahr einschließlich der Liste mit vertikalem Scroll-Overflow verwendet, sonst das Fenster. |

`lazyLoad: {}` aktiviert die Standardwerte. `false`, `null` oder `undefined`
deaktivieren Lazy Loading; `true` ist ungültig. Ungültige Zahlen fallen auf die
Standardwerte zurück. Ein ungültiger oder nicht gefundener Scroll-Selektor führt zu
einem Fehler. Für die automatische Erkennung zählen `overflow-y: auto`, `scroll`
und `overlay`.

Lazy Loading darf nicht mit einer gesetzten `pagination`-Option kombiniert werden;
auch `pagination: false` oder `null` führt zum Fehler. Die Renderanzahl wird durch
Lazy Loading statt durch `page` bestimmt. `show()` ist daher kein Ersatz für
`loadMore()` oder `resetLazyLoad()`.

Suche, Filter und Sortierung arbeiten auf allen Items und setzen die Renderanzahl
auf `initialItems` sowie die Scrollposition an den Anfang zurück. Das gilt auch beim
Zurücksetzen von Suche oder Filter über `search('')` bzw. `filter()`.
Gruppierung bleibt nutzbar; Gruppenüberschriften zählen nicht zum Item-Limit.
Automatisches Erweitern nutzt `IntersectionObserver`, ersatzweise Scroll-/Resize-Events.

```js
lazyUsers.resetLazyLoad(); // Anfangsanzahl rendern und zum Anfang scrollen
lazyUsers.resetLazyLoad({ scroll: false }); // Scrollposition beibehalten
lazyUsers.resetLazyLoad({ update: false, scroll: false });
lazyUsers.update(); // aufgeschobenen Neuaufbau ausführen

// Beim Abbau der Ansicht Lazy-Load-Beobachtung beenden:
lazyUsers.destroy();
```

### Lazy-Load-Events

- `lazyLoadStart` – vor dem Rendern eines zusätzlichen Blocks.
- `lazyLoadComplete` – nach dessen Rendering; `detail.items` enthält die neu sichtbaren Items.
- `lazyLoadExhausted` – beim Erreichen der beobachteten Schwelle, wenn alle lokalen
  Treffer sichtbar sind, oder bei entsprechendem manuellem `loadMore()`.
  Erfordert ein beobachtetes Item, wird also nicht für eine leere Liste ausgelöst.
  Mehrfache Meldungen für dieselbe aktive Schwelle werden unterdrückt; nach Verlassen
  und erneutem Erreichen oder einer Änderung der Liste kann das Event erneut auftreten.

Das Detailobjekt enthält `reason` (`'manual'` oder `'observer'`, auch beim
Scroll-Fallback), `previousLimit`, `nextLimit`, `renderedItems`, `matchingItems`,
`remainingItems` und `items`. Die drei Felder mit Item-Anzahlen sind Zahlen;
`items` ist bei Start und Erschöpfung ein leeres Array. Beim Start beschreibt
`renderedItems` noch den Zustand vor dem zusätzlichen Rendering.
`lazyLoadExhausted` bezieht sich nur auf die aktuell lokal verfügbaren Treffer und
kann als Signal für eigenes Nachladen dienen; neue Daten lassen sich mit `add()` ergänzen.

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
