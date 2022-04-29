The `#match` feature makes it possible to match an instance of an enumeration (an object with a string `type` property, and a `value` property).

Let's say we have a `Contact` type, which can either be a `telephone` type or an `email` type. In our template, we'd like to match the contact, and use a component based on what type of contact it is.

```gjs
import EmailContact from "./EmailContact";
import TelephoneContact from "./TelephoneContact";
import { Component } from "@glimmer/component";

export default class ContactComponent extends Component {
  <template>
    {{#match @contact}}
      {{:when "telephone" as |number|}}
        <TelephoneContact @number={{number}} />
      {{:when "email" as |email|}}
        <EmailContact @email={{email}} />
    {{/match}}
  </template>
}
```

In TypeScript:

```gts
import EmailContact from "./EmailContact";
import TelephoneContact from "./TelephoneContact";
import { Component } from "@glimmer/component";

type Contact =
  | {
      type: "telephone";
      value: string;
    }
  | {
      type: "email";
      value: string;
    };

interface ContactSignature {
  Args: {
    contact: Contact;
  };
}

export default class ContactComponent extends Component<{
  Args: { contact: Contact };
}> {
  <template>
    {{#match @contact}}
    {{:telephone as |number|}}
      <TelephoneContact @number={{number}} />
    {{:email as |email|}}
      <EmailContact @email={{email}} />
    {{/match}}
  </template>
}
```

### The Default Clause

A `#match` block can have an `else` clause. If the `#match` block is not matched, the `else` clause is used.

## Curly Components Get Named Blocks

The initial design of the [named blocks] feature added named blocks to angle-bracket components, but not to curly components ("This RFC does not propose an extension to curly syntax, although a future extension to curly syntax is expected.")

The `#match` syntax is based upon extending named blocks to curly syntax.

Since angle bracket components landed in Ember, curly components _that take a block_ exist philosophically to model control flow. Handlebars already has an `else` syntax, and a lot of control flow can be shoehorned into the notion of `else`. However, `#match` illustrates that general-purpose control flow cannot always be modelled as a pair of "default" and "else" blocks.

The semantics of named blocks in curly components are identical to the semantics of named blocks in angle bracket components.

The syntax of named blocks in curly components aligns with the `else` syntax, and do not require a closing tag.

[named blocks]: https://emberjs.github.io/rfcs/0460-yieldable-named-blocks.html

### Optional `else` Clause

Named Blocks in curly components can have an optional `else` clause. This is useful to allow a control-flow construct (like `#match`) to take an alternative while still allowing the entire space of block names to be used.

```gbs
{{#match @contact}}
{{:telephone as |number|}}
  <TelephoneContact @number={{number}} />
{{:email as |email|}}
  <EmailContact @email={{email}} />
{{else as |value|}}
  <p>{{value}}</p>
{{/match}}
```

## The Enumeration Format

The `#match` syntax takes an instance of an "enumeration" as its argument, and yields a block based on the type of the enumeration.

An enumeration is an object with:

- a `type` property, whose value is a string
- an optional `value` property, with any value

## TypeScript Support

This feature is based on TypeScript's [discriminated union](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions) feature.

This means that the `#match` syntax can be trivially translated to TypeScript.

Template Syntax:

```gbs
{{#match @contact}}
  {{:telephone as |number|}}
    <TelephoneContact @number={{number}} />
  {{:email as |email|}}
    <EmailContact @email={{email}} />
{{/match}}
```

Translated to TypeScript:

```ts
switch (this.args.contact.type) {
  case "telephone":
    TelephoneContact({ number: this.args.contact.value });
    break;
  case "email":
    EmailContact({ email: this.args.contact.value });
    break;
}
```

When translated this way, the values yielded to the blocks get the correct, narrowed type by TypeScript.

## Motivation: Asynchronous Data

In the design of Polaris features, we frequently want to model the state of asynchronous data as a reactive data structure.

This allows [resources](./reactivity.md) to use asynchronous loading internally, and expose their status as a reactive value.

We want to model this as an enumeration:

```ts
type AsyncData<T> =
  | {
      type: "loading";
    }
  | {
      type: "success";
      value: T;
    }
  | {
      type: "error";
      value: unknown;
    };
```

It is, of course, possible to use `AsyncData` in a template by using `#if`:

```gbs
{{#if (eq @data.type "loading")}}
  <p>Loading...</p>
{{else if (eq @data.type "success")}}
  <p>Hello {{@data.value.name}}</p>
{{else if (eq @data.type "error")}}
  <p>Something went wrong: {{@data.value}}</p>
{{/if}}
```

> 💡 This would even narrow correctly in TypeScript, provided that the `eq` helper is translated to `===`.

However, this is not ergonomically ideal, in part because it doesn't make it very obvious that `@data.value` **depends on** `@data.type`.

The `#match` syntax makes this more ergonomic and clearer:

```gbs
{{#match @data}}
{{:loading}}
  Loading...
{{:success as |user|}}
  <p>Hello {{user.name}}</p>
{{:error as |error|}}
  <p>Something went wrong: {{error}}</p>
{{/match}}
```

### Debouncing

In the [router] design, we'd like to model the existing model hook in the `Route` class as a function that returns a `Resource<AsyncData>`.

You could specify your loading and error states via `#match`.

#### A Route Today

```ts
import { Route } from "@ember/routing";

export default class extends Route {
  async model({ user_id }: { user_id: string }) {
    const data = await fetch(`/api/users/${user_id}`);
    return data.json();
  }
}
```

Loading:

```hbs
<Loading />
```

Error:

```hbs
Something went wrong...
```

Loaded:

```gbs
<h1>{{@model.name}}</h1>

<div class="user-details">
  <p>{{@model.email}}</p>
  <p>{{@model.phone}}</p>
</div>
```

#### A Polaris Route

```gts
import { Route } from "@ember/routing";

export default class extends Route {
  @use model = resource(() => RemoteData(`/api/users/${this.params.user_id}`));

  <template>
    {{#match this.model}}
    {{:loading}}
      Loading...
    {{:error as |error|}}
      <p>Something went wrong: {{error}}</p>
    {{:success as |user|}}
      <h1>{{user.name}}</h1>

      <div class="user-details">
        <p>{{user.email}}</p>
        <p>{{user.phone}}</p>
      </div>
    {{/match}}
  </template>
}
```

In this design:

- The route is a component that gets `params` from the router.
- The route is not long-lived. When the user navigates away from the route, the
  component is destroyed, like any other route.
- The "model hook" is no longer special. It's simply a resource.
- If the user navigates away from the route, and the `RemoteData` is still
  active, it is torn down. It was **possible** to model this with the model
  hook, but it basically falls out of making the model a resource and having an
  idiomatic `RemoteData`.

In this example, we don't necessarily want to show the loading spinner **immediately**. Instead, we may want to wait 100ms or so before showing it. We would also want to wait the same amount of time if `#match` gets a **new** input, and just keep around the old UI if the new data loads quickly.

This example demonstrates that we probably want a version of `#match` that's tailored for the case of `AsyncData`.

_Roughly speaking, it would keep two copies of its input: the `current` one and the `next` one, and if the next input is `loading`, it would wait 100ms before committing it to `current`._

> 💡 If we **ship** `RemoteData`, we will certainly want to give it the full suite of `fetch` features. However, we can define the shape of the `AsyncData` enumeration as a **protocol** without shipping a concrete implementation.
