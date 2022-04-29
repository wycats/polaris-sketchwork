# Ember Reactivity

> Note to readers: For the most part, this design document describes the current state of the Ember.js reactivity system, as of Octane, as a way of laying the groundwork for understanding Polaris features. When this document is talking about Polaris features, it explicitly calls that out.

## How Ember Reactivity Works

### The Data Universe

[reactive storage]: #data-reactive-storage
[cell]: #data-reactive-storage
[reactive constructor]: #data-composite
[data universe]: #data-universe
[formula]: #data-formula
[composite]: #data-composite
[composite reactive object]: #data-composite
[composite reactive objects]: #data-composite

<dl>
  <dt id="data-reactive-storage">Reactive Data Cell</dt>
  <dd>

An atomic piece of reactive storage that the app can read from or write to.

In Octane, the only kind of Reactive Cell is a `@tracked` field. Polaris will also include a `cell` type to create standalone reactive storage outside of a class.

  </dd>

  <dt id="data-composite">Composite Reactive Object</dt>
  <dd>

An object that uses multiple reactive values internally. A Composite Reactive Object exposes methods to read and write to its underlying reactive values.

Composite Reactive Objects are _Constructed_ when they are first first created. The code that constructs a Reactive Object is called a _Reactive Constructor_.

The code in a Reactive Constructor may _read_ from the data universe, but it must not _write to_ the data universe. **However**, if a _Reactive Constructor_ initializes a reactive variable for the first time, it **may** mutate the reactive variable for the duration of the Reactive Constructor.

  </dd>

  <dt id="data-universe">The Data Universe</dt>
  <dd>
  
The collection of all Reactive Storage.
  
  </dd>

  <dt id="data-formula">Formula</dt>
  <dd>

Normal JavaScript functions or getters that compute values based on other reactive values. These functions do not need to be annotated, but they must not mutate the data universe.

The Ember [Rendering] process **reads** from Reactive Storage and Formulas in the data universe, but **must not write to it**. (In Ember, Formulas used in the Rendering process are called "helpers".)

> 👍 A good rule of thumb: don't mutate anything in your getters or helpers.

  </dd>

</dl>

Polaris will include a number of built-in [Composite Reactive Objects]: Map, Set, WeakMap, WeakSet, array and object.

> 💡 All reactive storage built into Ember follows the **Equivalence** rule. This means that they are (a) annotations of storage built into JavaScript, (b) have the same behavior as the underlying JavaScript storage, and (c) behave equivalently if the annotation is removed. The annotation causes the [rendered] output to remain up to date when the storage is mutated, but it does not affect the behavior or timing of the data itself.

#### The Data Universe is Always Coherent

When _Reactive Storage_ is mutated, the mutation takes effect immediately. Any code that reads from the variable will see the new value.

This means that the _Data Universe_ **is always coherent**. If you make a change to a reactive variable, and you call a function that depends on the reactive variable, the function will see the new state of the reactive variable, and the value it returns will therefore be up to date.

<details id="ember-reactivity-example">

<summary>Example</summary>

```ts
class Person {
  @tracked name: string;
  @tracked location: string;

  constructor(name: string, location: string) {
    this.name = name;
    this.location = location;
  }

  get card() {
    return `${this.name} (${this.location})`;
  }
}

const wycats = new Person("Yehuda", "New York");

wycats.card; // "Yehuda (New York)"

wycats.name = "Yehuda Katz";
wycats.card; // "Yehuda Katz (New York)"

wycats.location = "San Francisco";
wycats.card; // "Yehuda Katz (San Francisco)"

wycats.location = "Portland";
wycats.card; // "Yehuda Katz (Portland)"
```

</details>

### The Output

[rendering]: #output-rendering
[rendered]: #output-rendering

<dl>
  <dt id="output-rendering">Rendering</dt>
  <dd>
  
Ember _reads_ from Reactive Variables, as well as functions and getters that depend on reactive variables, in order to create and update the DOM.

Functions and getters called during Rendering are called _Formulas_. Formulas may **read** from the data universe, but they must not **mutate** the Data Universe.

  </dd>

  <dt>Actions</dt>
  <dd>
  
An _Action_ is any code that runs inside of a browser callback, such as a click handler. Actions may freely read or mutate the Data Universe. By definition, an _Action_ does not happen during _Rendering_.
  
  </dd>

</dl>

The constructor in the `Person` class [above](#ember-reactivity-example) is a _Reactive Constructor_.

### Resources

[resource]: #resources
[resources]: #resources

A _Resource_ is a user-defined [Composite Reactive Object] with cleanup behavior. You get access to a resource's _value_ by linking it to a parent object. When the parent object is destroyed, the resource is destroyed as well, which means its cleanup behavior is run.

For example, a Resource might be a class that represents the current version of a document delivered over a web socket. When the connection is closed, the web socket should be closed.

#### Example

```js
import { Resource, cell } from "@glimmer/reactivity";

function RemoteData(url) {
  return Resource((resource) => {
    const value = cell({ type: "loading" });
    const controller = new AbortController();

    resource.on.cleanup(() => controller.abort());

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          value.current = { type: "error", value: response.statusText };
        }
      })
      .then((data) => {
        value.current = { type: "success", value: data };
      });

    return value;
  });
}
```

<details>

<summary>In TypeScript</summary>

```ts
import { Resource, type Linkable, cell } from "@glimmer/reactivity";

function RemoteData<T>(url: string): Linkable<RemoteData<T>> {
  return Resource((resource) => {
    const value = cell({ type: "loading" });
    const controller = new AbortController();

    resource.on.cleanup(() => controller.abort());

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          value.current = { type: "error", value: response.statusText };
        }
      })
      .then((data) => {
        value.current = { type: "success", value: data };
      });
  });
}

type RemoteData<T> =
  | {
      type: "loading";
    }
  | {
      type: "success";
      data: T;
    }
  | {
      type: "error";
      error: Error;
    };
```

</details>

In this example, the `RemoteData` function takes a URL and returns a linkable resource.

The `Resource` function is similar to `new Promise` in JavaScript. It takes a callback that constructs the resource (a [reactive constructor]).

In this case, the resource's constructor uses a [cell] to represent the current state of the resource. It uses an [AbortController] to make the fetch abortable, and then registers a resource cleanup handler that aborts it.

It initiates the fetch, and in response to the fetch succeeding or failing, it sets the value of the cell.

Finally, it returns the cell, which is the **value** of the resource.

And this is how it's used in a component:

```gjs
import { use, resource } from "@glimmer/reactivity";

export default class UserComponent extends Component {
  @use user = () =>
    RemoteData(`https://api.example.com/users/${this.args.id}`);

  <template>
    {{#if (eq (user.type) "loading")}}
      Loading...
    {{else if (eq (user.type) "error")}}
      Error: {{user.value}}
    {{else}}
      Hi! {{user.value.name}}
    {{/if}}
  </template>
}
```

<details>

<summary>With the #match Proposal</summary>

```gjs
import { use, resource } from "@glimmer/reactivity";
import { RemoteData } from "#lib/remote-data";

export default class UserComponent extends Component {
  @use user = () =>
    RemoteData("https://api.example.com/users/${this.args.id}");

  <template>
    {{#match this.user}}
      {{:when "loading"}}
        Loading...
      {{:when "error" as |error|}}
        Error: {{error}}
      {{:when "success" as |user|}}
        Hi! {{user}}
    {{/match}}
  </template>
}
```

</details>

[abortcontroller]: https://developer.mozilla.org/en-US/docs/Web/API/AbortController

#### Details

1. If you return a [cell] or formula (a function with no parameters) from a resource constructor, the value of the resource is the value of the cell or return value of the formula. Otherwise, value of the resource is the return value of the resource constructor.
2. The `@use` decorator links the resource to the instance of the object that it's used in (in this case, the component).
3. The function passed to `resource()` is, itself, a formula. If it uses reactive values when constructing the resource, and they change, the resource will be cleaned up and re-created. (This effectively makes resources [restartable] by default).

[restartable]: http://ember-concurrency.com/docs/task-concurrency/#restartable

#### Using Resources in Templates

[in templates]: #using-resources-in-templates

Resources are used in templates the way helpers are used in Octane.

> 💡 That's because resources and helpers are **the same thing** in Polaris.

```gjs
import { RemoteData } from "#app/lib/remote-data";

<template>
  {{#let (RemoteData (concat "https://api.example.com/users/" @id)) as |data|}}
    {{#if (eq (data.type) "loading")}}
      Loading...
    {{else if (eq (data.type) "error")}}
      Error: {{data.value}}
    {{else}}
      Hi! {{data.value.name}}
    {{/if}}
  {{/let}}
</template>
```

<details>

<summary>With #match Proposal</summary>

```gjs
import { RemoteData } from "#app/lib/remote-data";

<template>
  {{#let (RemoteData (concat "https://api.example.com/users/" @id)) as |data|}}
    {{#match data}}
      {{:when "loading"}}
        Loading...
      {{:when "error" as |error|}}
        Error: {{error}}
      {{:when "success" as |user|}}
        Hi! {{user.name}}
    {{/match}}
  {{/let}}
</template>
```

</details>

Two differences between using a resource in a template and using a resource in a class:

- In a class, you use `@use` to link the resource's lifetime to the lifetime of the class instance. In a template, that happens automatically.
- In a class, you construct the resource with `resource(() => ...)`. In a template, you don't need to wrap the call to `RemoteData`, because the template syntax already does that for you.

## Relationship to Octane Features

- Resources are a generalization of [Class Helpers] that can be used [in templates], but also in normal JavaScript.

[class helpers]: https://emberjs.com/api/ember/2.18/classes/Helper/methods/helper?anchor=class-helper

## Relationship to Shipped Primitives

- The lifetime linking feature of resources is built on [associateDestroyableChild].
- The ability to register cleanup handlers outside of `willDestroy` is built on [registerDestructor].
- Automatically cleaning up the resource when its arguments change is built on [destroy] and [createCache].

## Relationship to Approved but Unshipped Primitives

- Cell is built on [createStorage] (approved RFC #669). It could mostly be built on top of `@tracked`, but we need [cell] to make the cell the value of the resource (and avoid an unnecessary `.current` in uses of resources representing a single value).

While [createStorage] is not currently shipped in Ember, a high-fidelity [polyfill][create-storage-polyfill] exists.

The current implementation of the reactivity system in Ember has a notion of description that can be used in debugging. This is a good idea, and we should align it with the design of [composite] reactive objects.

[associatedestroyablechild]: https://api.emberjs.com/ember/4.3/functions/@ember%2Fdestroyable/associateDestroyableChild
[registerdestructor]: https://api.emberjs.com/ember/4.3/functions/@ember%2Fdestroyable/registerDestructor
[destroy]: https://api.emberjs.com/ember/4.3/functions/@ember%2Fdestroyable/destroy
[createcache]: https://api.emberjs.com/ember/4.3/functions/@glimmer%2Ftracking%2Fprimitives%2Fcache/createCache
[createstorage]: https://github.com/emberjs/rfcs/blob/master/text/0669-tracked-storage-primitive.md
[create-storage-polyfill]: https://github.com/ember-polyfills/ember-tracked-storage-polyfill
