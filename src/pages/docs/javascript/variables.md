---
title: Variables and Data Types
layout: ../../../layouts/DocsLayout.astro
---

# Variables and Data Types in JavaScript

Learn about different ways to declare variables and understand JavaScript's data types.

## Variable Declarations

JavaScript has three ways to declare variables:

```javascript
var oldWay = 'Legacy declaration';
let modern = 'Block-scoped variable';
const constant = 'Immutable binding';
```

### let vs const

- Use `let` when the variable needs to be reassigned
- Use `const` for values that shouldn't change

## Data Types

JavaScript has eight basic data types:

1. **Number**
   ```javascript
   let age = 25;
   let price = 99.99;
   ```

2. **String**
   ```javascript
   let name = 'John';
   let greeting = `Hello, ${name}`;
   ```

3. **Boolean**
   ```javascript
   let isActive = true;
   let isLoggedIn = false;
   ```

4. **null**
   ```javascript
   let empty = null;
   ```

5. **undefined**
   ```javascript
   let notDefined;
   ```

6. **Object**
   ```javascript
   let user = {
     name: 'John',
     age: 30
   };
   ```

7. **Symbol**
   ```javascript
   const uniqueKey = Symbol('description');
   ```

8. **BigInt**
   ```javascript
   const bigNumber = 9007199254740991n;
   ```

## Type Coercion

JavaScript automatically converts types in certain operations:

```javascript
console.log('5' + 2);  // Outputs: '52'
console.log('5' - 2);  // Outputs: 3
console.log(true + 1); // Outputs: 2
```

## Best Practices

1. Always declare variables before using them
2. Use meaningful variable names
3. Prefer `const` over `let` when possible
4. Be aware of type coercion in operations