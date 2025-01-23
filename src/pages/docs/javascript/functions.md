---
title: Functions in JavaScript
layout: ../../../layouts/DocsLayout.astro
---

# Functions in JavaScript

Functions are one of the fundamental building blocks in JavaScript. Learn how to create and use functions effectively.

## Function Declarations

There are several ways to define functions in JavaScript:

### Function Declaration

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}
```

### Function Expression

```javascript
const greet = function(name) {
  return `Hello, ${name}!`;
};
```

### Arrow Function

```javascript
const greet = (name) => `Hello, ${name}!`;
```

## Parameters and Arguments

Functions can accept parameters and use default values:

```javascript
function createUser(name, age = 18) {
  return {
    name,
    age
  };
}

// Using rest parameters
function sum(...numbers) {
  return numbers.reduce((total, num) => total + num, 0);
}
```

## Higher-Order Functions

Functions that take other functions as arguments or return functions:

```javascript
function multiply(factor) {
  return function(number) {
    return number * factor;
  };
}

const double = multiply(2);
console.log(double(5)); // Outputs: 10
```

## Closures

Functions retain access to their outer scope:

```javascript
function counter() {
  let count = 0;
  return {
    increment() { count++; return count; },
    decrement() { count--; return count; }
  };
}

const myCounter = counter();
console.log(myCounter.increment()); // 1
console.log(myCounter.increment()); // 2
console.log(myCounter.decrement()); // 1
```

## Best Practices

1. Keep functions small and focused
2. Use meaningful function names
3. Document complex functions
4. Handle edge cases and errors
5. Write pure functions when possible