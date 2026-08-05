---
title: 'Form Validation & $validation'
description: 'Learn how to use Avenx-JS declarative form validation with data-ax-validate, built-in validation rules, and the reactive this.state.$validation schema.'
---

Avenx-JS includes a built-in declarative form validation engine (`lib/core/validation/validator.js`) integrated directly into `AvenxComponent`. Form input elements specify validation constraints using the `data-ax-validate` attribute. On user interaction (`input`/`change` events) and component updates, Avenx-JS automatically evaluates rules and populates the reactive `this.state.$validation` state object.

---

## `data-ax-validate` Directive Syntax

The `data-ax-validate` directive is applied directly to `<input>`, `<textarea>`, and `<select>` elements.

### 1. Pipe-Delimited Rule Definitions

Combine multiple validation rules using the pipe (`|`) delimiter:

```html
<input
  name="email"
  data-ax-bind="email"
  data-ax-validate="required|email"
/>
```

### 2. Rule Arguments

Pass arguments to rules using a colon (`:`):

```html
<input
  type="password"
  name="password"
  data-ax-bind="password"
  data-ax-validate="required|min:8"
/>

<input
  type="password"
  name="confirmPassword"
  data-ax-bind="confirmPassword"
  data-ax-validate="required|same:password"
/>
```

### 3. Custom Validation Messages

Custom error messages can be defined inline or via JSON maps:

#### Inline Custom Messages

Append a custom error message after a second colon (`:`):

```html
<input
  name="password"
  data-ax-bind="password"
  data-ax-validate="required:Password is mandatory|min:8:Must be at least 8 characters"
/>
```

#### JSON Message Map (`data-ax-validate-messages`)

Provide custom messages per rule using a JSON string in `data-ax-validate-messages`:

```html
<input
  name="username"
  data-ax-bind="username"
  data-ax-validate="required|min:4|alphanumeric"
  data-ax-validate-messages='{
    "required": "Username cannot be empty",
    "min": "Username must be at least 4 characters",
    "alphanumeric": "Only letters and numbers are allowed"
  }'
/>
```

---

## Built-in Validation Rules Reference

Avenx-JS includes 10 built-in validation rules:

| Rule Name | Argument | Supported Types | Evaluation & Behavior | Default Error Message |
| :--- | :--- | :--- | :--- | :--- |
| `required` | None | `boolean`, `Array`, `string` | Fails if boolean is `false`, array length is `0`, or trimmed string is empty. | `Field is required` |
| `email` | None | `string` | Validates against regular expression `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Empty strings pass unless `required` is present. | `Invalid email address` |
| `min` | `number` | `number`, `Array`, `string` | Fails if numeric value, array length, or string character count is less than `arg`. | `Minimum length/value is <arg>` |
| `max` | `number` | `number`, `Array`, `string` | Fails if numeric value, array length, or string character count exceeds `arg`. | `Maximum length/value is <arg>` |
| `pattern` / `regex` | `string` | `string` | Evaluates string value against regular expression `new RegExp(arg)`. | `Field format is invalid` |
| `numeric` / `number` | None | `string` | Fails if non-empty string does not match numeric format `/^-?\d+(\.\d+)?$/`. | `Must be a number` |
| `alpha` | None | `string` | Fails if non-empty string contains characters outside `/^[a-zA-Z]+$/`. | `Must contain only letters` |
| `alphanumeric` | None | `string` | Fails if non-empty string contains characters outside `/^[a-zA-Z0-9]+$/`. | `Must contain only letters and numbers` |
| `url` | None | `string` | Fails if non-empty string fails URL parsing via `new URL(val)`. | `Invalid URL format` |
| `same` | `stateProp` | `any` | Checks strict equality (`===`) against `this.state[stateProp]`. | `Must match <stateProp>` |

---

## Field Name Resolution

The validator determines the key name for each field in `this.state.$validation` by checking attributes on the element in order of priority:

1. `name` attribute (e.g. `name="user_email"`)
2. `data-ax-bind` property (e.g. `data-ax-bind="email"`)
3. `id` attribute (e.g. `id="email-input"`)
4. Fallback default string: `'field'`

---

## Reactive `this.state.$validation` Schema

When a component contains elements with `data-ax-validate`, Avenx-JS initializes and updates `this.state.$validation` with the following structure:

```typescript
interface ValidationState {
  /**
   * True if all validated form fields in the component are valid; false otherwise.
   */
  isValid: boolean;

  /**
   * Maps field names to arrays of active validation error strings.
   */
  errors: Record<string, string[]>;

  /**
   * Detailed per-field validity information.
   */
  fields: Record<
    string,
    {
      isValid: boolean;
      errors: string[];
    }
  >;
}
```

### Example `$validation` Object State

```json
{
  "isValid": false,
  "errors": {
    "email": ["Invalid email address"],
    "password": []
  },
  "fields": {
    "email": {
      "isValid": false,
      "errors": ["Invalid email address"]
    },
    "password": {
      "isValid": true,
      "errors": []
    }
  }
}
```

---

## Component Instance Methods

### Programmatic Validation (`this.$validateElement(el)`)

You can trigger validation programmatically on any DOM element by passing it to `this.$validateElement(el)`:

```javascript
// Programmatically validate an input element
const emailInput = this.$element.querySelector('input[name="email"]');
const errors = this.$validateElement(emailInput);

console.log(errors); // ['Invalid email address']
```

Calling `$validateElement` evaluates the element's rules against its current value, updates `this.state.$validation` reactively, and returns an array of active error messages.

---

## Full Form Submit Example

The following Single File Component example demonstrates form validation, error message rendering, dynamic CSS class binding (`data-ax-class`), and submit handling:

```javascript
// src/components/login-form.component.js
export default {
  state: {
    email: '',
    password: '',
    submitted: false,
  },

  methods: {
    handleSubmit(event) {
      event.preventDefault();
      this.state.submitted = true;

      // Check form validity before submission
      if (!this.state.$validation.isValid) {
        console.warn('Form validation failed:', this.state.$validation.errors);
        return;
      }

      console.log('Submitting form with data:', {
        email: this.state.email,
        password: this.state.password,
      });
    },
  },

  template: `
    <form @submit="handleSubmit">
      <div class="form-group">
        <label>Email Address</label>
        <input
          type="email"
          name="email"
          data-ax-bind="email"
          data-ax-validate="required|email"
          data-ax-class="{ 'has-error': state.$validation?.fields?.email?.isValid === false }"
          placeholder="you@example.com"
        />
        <span
          data-ax-show="state.$validation?.errors?.email?.length > 0"
          class="error-text"
        >
          {{ state.$validation?.errors?.email?.[0] }}
        </span>
      </div>

      <div class="form-group">
        <label>Password</label>
        <input
          type="password"
          name="password"
          data-ax-bind="password"
          data-ax-validate="required:Password is required|min:8:Minimum 8 characters"
          data-ax-class="{ 'has-error': state.$validation?.fields?.password?.isValid === false }"
          placeholder="••••••••"
        />
        <span
          data-ax-show="state.$validation?.errors?.password?.length > 0"
          class="error-text"
        >
          {{ state.$validation?.errors?.password?.[0] }}
        </span>
      </div>

      <button
        type="submit"
        data-ax-disabled="!state.$validation?.isValid"
      >
        Sign In
      </button>
    </form>
  `,
};
```
