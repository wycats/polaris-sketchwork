## Optional Second Phase

The first phase of the content tags specification translates the content tag syntax to JavaScript. This is a very useful input into downstream tools, many of which already exist.

For example, the [graphql-tag] library is a JavaScript library that can be used to generate a GraphQL query from a tagged template string.

```js
import gql from 'graphql-tag';

const query = gql`
  {
    user(id: 5) {
      firstName
      lastName
    }
  }
`
```

When using the content tag preprocessor, you could write:

```gts
import gql from 'graphql-tag';

const query =
  <gql>
    {
      user(id: 5) {
        firstName
        lastName
      }
    }
  </gql>
```

Without any additional steps, this would be translated to the original graphql-tag syntax, and everything would work as expected.

However, you may want to use the content tag preprocessor as the first step in a build pipeline to generate JavaScript code.

For example, consider the `<template>` tag feature in Ember Polaris:

```gts
import { template } from '@glimmer/template';

const name = "Godfrey";

<template>
  <div>
    <h1>Hello, {{name}}</h1>
  </div>
</template>
```

The content tag preprocessor would convert this to:

```gts
import { template } from '@glimmer/template';

const name = "Godfrey";

export default template`
  <div>
    <h1>Hello, {{name}}</h1>
  </div>
`;
```

But the template still references `name`, which is not available at runtime. To make this work, Glimmer templates need a second phase of compilation, which compiles to:

```js
import { template } from '@glimmer/template';

const name = "Godfrey";

export default template("<div>\\n  <h1>Hello, {{name}}</h1>\\n</div>", () => ({ name }));
```

It is, of course, possible to write a second phase of compilation that works with the output of the content tag preprocessor using something like Babel. That's the point of the design of the content tag preprocessor: to translate the custom syntax into something that can be further translated using vanilla JavaScript build pipelines.

That said, in order to build the second phase, you would need to:

- Make sure to carefully realign output source maps
- Do the same steps for eslint and TypeScript, as well as any other tools that depend on rich static analysis.

To make it easier to build this sort of tool, we intend to provide a [second phase compiler] utility that helps translate the output of the content tag preprocessor into runtime JavaScript.

The design of the second phase compiler will be based on our implementation of such a tool for the `<template>` tag feature in Ember Polaris.

[graphql-tag]: https://www.npmjs.com/package/graphql-tag
[second phase compiler]: content-tag/second-phase-compiler.md
