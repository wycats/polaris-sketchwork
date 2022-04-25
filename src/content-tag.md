# JavaScript With Content Tags

🚧🚧🚧🚧 This document is a work in progress. The precise details are still rapidly evolving, and not everything that we already know is written down yet. 🚧🚧🚧🚧

JavaScript with Content Tags is an extension to ECMAScript that makes it possible to embed other languages in JavaScript. Importantly, embedded content can refer to variables in the surrounding JavaScript environment.

Like template literals, this proposal is designed for modularity: anyone can define a content tag without needing to change the core design. Unlike template literals, content tags have a **build-time** component, which allows them to translate their specific content tag into JavaScript.

## The Syntax

```diff
  PrimaryExpression :
+   ContentTag

  Declaration :
+   ContentTag

  FunctionBody :
+   ContentTag

  ClassElement :
+   ContentTag
+
+ ContentTag :
+   "<" ContentTagOpen [TemplateAttributes] ">" ContentTagBody "</" ContentTagClose ">"
+
+ ContentTagOpen :
+   TagName (* lookahead: whitespace or ">")
+
+ ContentTagClose :
+   TagName (* must match most recent ContentTagOpen *)
+ 
+ TagName :
+     Identifier
+   | Identifier { "." Identifier }
+ 
+ ContentTagBody :
+   <unicode character>* (* lookahead: "</template>" *)
+
+ TemplateAttributes :
+   <whitespace> { TemplateAttribute } <whitespace>
+
+ TemplateAttribute :
+   AttributeName (* lookahead: <whitespace> | ">" *)
+   AttributeName "=" AttributeValue
+
+ AttributeName :
+   { <not whitespace or "="> }
+
+ AttributeValue :
+     "{" AttributeExpression "}"
+   | SingleQuotedAttributeValue
+   | DoubleQuotedAttributeValue
+
+ AttributeExpression :
+   <described below>
+
+ SingleQuotedAttributeValue :
+   "'" { <not "'"> } "'"
+ 
+ DoubleQuotedAttributeValue :
+   '"' { <not '"'> } '"'
```

### AttributeExpression

AttributeExpression is lexed using the [simplified JavaScript lexer].

[simplified JavaScript lexer]: content-tag/simplified-javascript-lexer.md

## Translation

### PrimaryExpression

The content tag name is translated to the tag reference of a tagged template literal. The body of the tag is translated to the body of the tagged template literal.

If the content tag contains attributes, the attributes are translated to an object literal. Attributes with values are translated to keys and values in the object literal. Attributes without values are translated the same way, with the value `true`. The object literal is passed to the tagged template literal.

#### Basic Example

```jsx
function Card({ person }) {
  return <jsx>
    <div className="card">
      <div className="card-header">
        <h3>{person.name}</h3>
      </div>
      <div className="card-body">
        <p>{person.bio}</p>
      </div>
    </div>
  </jsx>
}
```

This would be translated to:

```js
function Card({ person }) {
  return jsx`
    <div className="card">
      <div className="card-header">
        <h3>${person.name}</h3>
      </div>
      <div className="card-body">
        <p>${person.bio}</p>
      </div>
    </div>
  `;
}
```

#### Example With Attributes

```gts
const card = <template strict>
  <div class="card">
    <div className="card-header">
      <h3>{{@person.name}}</h3>
    </div>
    <div class="card-body">
      <p>{{@person.bio}}</p>
    </div>
  </div>
</template>
```

This would be translated to:

```js
const card = template({ strict: true })`
  <div class="card">
    <div className="card-header">
      <h3>${person.name}</h3>
    </div>
    <div class="card-body">
      <p>${person.bio}</p>
    </div>
  </div>
`;
```

## Compiler Extension Architecture

## FAQ

### Why Not Template Literals?

JavaScript with Content Tags makes it possible for languages with their own syntax for variable references to use that syntax when referring to JavaScript variables. It also allows embedded languages to use any characters without worrying about escaping them, and allows the embedded language to restrict how JavaScript variables can be used.

In contrast, template literals must use the JavaScript `${}` syntax, and the embedded content in a template literal is an arbitrary JavaScript expression.

#### Example: Embedding Handlebars

For example, consider embedding Handlebars in JavaScript:

```gjs
const person = {
  name: "John",
  location: "New Mexico, USA",
};

const contact = <template>
  <p>
    <strong>{{person.name}}</strong> ({{person.location}})
  </p>
</template>

contact(); // <p><strong>John</strong> (New Mexico, USA)</p>
```

We could parameterize the template using the approach Ember uses today:

```gjs
const contact =
  <template>
    <p>
      <strong>{{@name}}</strong> ({{@location}})
    </p>
  </template>

contact({ name: "John", location: "New Mexico, USA" });
// <p><strong>John</strong> (New Mexico, USA)</p>
```

Or by creating a function that takes the person as a parameter:

```gjs
function Contact(person) {
  <template>
    <p>
      <strong>{{person.name}}</strong> ({{person.location}})
    </p>
  </template>
}

contact({ name: "John", location: "New Mexico, USA" });
// <p><strong>John</strong> (New Mexico, USA)</p>
```

We could also adopt something like the Ember approach to components:

```gts
function Contact(args: { name: string; location: string }) {
  <template>
    <p>
      <strong>{{args.name}}</strong> ({{args.location}})
    </p>
  </template>
}

const Person =
  <template>
    <Contact @name="John" @location="New Mexico, USA" />
  </template>
```

#### Example: Embedding JSX

The content tags framework makes it possible to embed JSX into JavaScript without having to use the `${}` syntax.

Consider this example from the [JSX] proposal, using template literals:

```js
// Template Literals
var box = jsx`
  <${Box}>
    ${
      shouldShowAnswer(user) ?
      jsx`<${Answer} value=${false}>no</${Answer}>` :
      jsx`
        <${Box.Comment}>
         Text Content
        </${Box.Comment}>
      `
    }
  </${Box}>
`;
```

This obviously reads very poorly. The JSX spec also rightly points out that simply wrapping the JSX in a template literal is not sufficient.

```js
var box = jsx`
  <Box>
    {
      shouldShowAnswer(user) ?
      <Answer value={false}>no</Answer> :
      <Box.Comment>
         Text Content
      </Box.Comment>
    }
  </Box>
`;
```

> However, this would lead to further divergence. Tooling that is built around the assumptions imposed by template literals wouldn't work. It would undermine the meaning of template literals. It would be necessary to define how JSX behaves within the rest of the ECMAScript grammar within the template literal anyway.

To address the issue, JSX defines some additional ways to access local variables.

```jsx
var box =
  <Box>
    {
      shouldShowAnswer(user) ?
      <Answer value={false}>no</Answer> :
      <Box.Comment>
         Text Content
      </Box.Comment>
    }
  </Box>;
```

[JSX]: https://facebook.github.io/jsx/#sec-why-not-template-literals

Since the content tags framework allows embedded languages to specify how their content should access local variables, you could embed JSX in JavaScript:

```gjs
var box =
  <jsx>
    <Box>
      {
        shouldShowAnswer(user) ?
        <Answer value={false}>no</Answer> :
        <Box.Comment>
          Text Content
        </Box.Comment>
      }
    </Box>
  </jsx>
```

#### Example: Embedding CSS

The general content tags framework allows us to easily embed other languages in JavaScript, and allow those languages to refer to JavaScript variables. Let's define a tiny extension to CSS that allows us to refer to JavaScript variables:

```gjs
const color = "red";

<style>
  .red {
    color: $color;
  }
</style>
```

In this case, we allow `$`-prefixed names to refer to JavaScript variables.

> We will also allow paths (starting with an identifier followed by any number of `.` members) to be used as variables, and we will allow standalone functions to be used as CSS functions.

We could combine a feature like this with the Handlebars example above to make it possible to create static HTML and CSS files inside JavaScript:

```gts
const light = "#fff";
const dark = "#000";

function border(color: HexColor): string {
  return `1px solid ${color}`;
}

const styles =
  <style>
    .box {
      border: border($light);
    }
  </style>

<template>
  <styles />

  <div class="box">
    Hello, World!
  </div>
</template>
```

#### Conclusion

In general, these examples are meant to illustrate the way that content tags can take advantage of JavaScript's lexical scope in ways that are idiomatic to their embedded languages.

🚧🚧🚧🚧 This section is a work in progress. 🚧🚧🚧🚧