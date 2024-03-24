---
title: 'Angular Composables'
excerpt: 'In this article we explore a pattern that arises in Vue.js and how it can be applied in Angular. We investigate how we can create these small units of stateful logic that can be re-used by different components.'
coverImage: '/assets/blog/angular-composables/angular-composables-4.jpg'
date: '2023-05-01T05:35:07.322Z'
author:
  name: Stefanos Lignos
  picture: '/assets/my-photo-2.jpg'
ogImage:
  url: '/assets/blog/angular-composables/angular-composables-4.jpg'
---

We all know Lodash, a library for reusing stateless logic in our projects. What if we had a similar toolkit for reusing stateful logic in an Angular project?

*Composables is not a new idea. It's a concept coming from `Vue.js`. A lot of the examples and ideas I use in this blog come directly from [Vue.js Composables](https://vuejs.org/guide/reusability/composables.html) docs.*

In version 16.0.0-next.0 the Angular team introduced a first implementation of Signals which is a reactive primitive which can offer fine-grained reactivity in Angular. With such big changes, also considering other very useful features the Angular team has introduced in the latest versions like the [inject](https://angular.io/api/core/testing/inject) function or the concept of [DestroyRef](https://next.angular.io/api/core/DestroyRef), it's inevitable that new patterns will emerge. This article is an attempt to explore this pattern in the context of Angular this time. 

In Angular itself we already see a transition of what we can call `Functional Services`. It started with the introduction of functional guards and resolvers in version [14.2.0](https://github.com/angular/angular/blob/main/CHANGELOG.md#1420-2022-08-25) and was continued with the introduction of functional interceptors in version [15.0.0](https://github.com/angular/angular/blob/main/CHANGELOG.md#1500-2022-11-16). But what is an Angular Composable, why and how would we use it in a project? 

### What is an Angular Composable?

A "composable" in the context of an Angular application is a function which encapsulates stateful logic using the Signals API. The composables can be re-used in multiple components, can be nested within each other and can help us to organize the stateful logic of our components into small, flexible and simpler units.

In the same way, we create util functions in order to reuse stateless logic across our components, we create  composables to share stateful logic. You can check some of the potential use cases for an Angular project [here](https://vueuse.org/functions.html).   

But let's see how a composable would look in an Angular application. In the following examples I don't use the API which is proposed in the RFC for Angular Signals. When all the features of this API are in place (e.g [Application rendering lifecycle hooks, Signal-based queries](https://github.com/angular/angular/discussions/49682)) we will be able to write these composables in a much nicer way and we will be able to provide to them more capabilities.

Let's start with a very simple example.

### Mouse Tracker Example

In an Angular component using Signals, the mouse tracking functionality would look like this:

```ts
@Component({
  standalone: true,
  template: ` {{ x() }} {{ y() }} `,
})
export class MouseTrackerComponent implements AfterViewInit, OnDestroy {
  // injectables
  document = inject(DOCUMENT);

  // state encapsulated and managed by the composable
  x = signal(0);
  y = signal(0);

  ngAfterViewInit() {
    document.addEventListener('mousemove', this.update.bind(this));
  }

  // a composable can update its managed state over time.
  update(event: MouseEvent) {
    this.x.update(() => event.pageX);
    this.y.update(() => event.pageY);
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.update.bind(this));
  }
}
```

If we want to reuse this logic, we can extract it in a composable like this:

```ts
// mouse-tracker.ts file

export function useMouse() {
  // injectables
  const document = inject(DOCUMENT);

  // state encapsulated and managed by the composable
  const x = signal(0);
  const y = signal(0);

  // a composable can update its managed state over time.
  function update(event: MouseEvent) {
    x.update(() => event.pageX);
    y.update(() => event.pageY);
  }

  document.addEventListener('mousemove', update);

  // lifecycle to teardown side effects.
  inject(DestroyRef).onDestroy(() =>
    document.removeEventListener('mousemove', update)
  );

  // expose managed state as return value
  return { x, y };
}
``` 

And now it can be used in all the different components like this:

```ts
@Component({
  standalone: true,
  template: ` {{ mouse.x() }} {{ mouse.y() }} `,
})
export class MouseTrackerComponent {
  mouse = useMouse();
}
```

[Stackblitz](https://stackblitz.com/edit/angular-2kiv4w-s3krxr?file=src/app/composables/mouse-tracker.ts)


What we simply did was to extract the logic we had in the component (and we want to reuse in other components) into an external function. Here are some conventions and best practices we followed in the above example:

#### Naming

It is a convention to name composable functions with camelCase names that start with "use".


#### Return Values

From this function we return the state we want to be exposed in the component. The state consists of one or more signals which can be used in the template of our component or other computed properties or effects. In our example we initialized the `mouse` field with the `useMouse` composable which returns two signals.

#### Usage Restrictions

*Because this function injects the `DOCUMENT` token using the `inject` function can only be used in construction context (i.e. in the of constructor, fields initialization) but not in the component's lifecycle hooks for example*

Angular v16 has introduced a new provider called DestroyRef. DestroyRef lets you set callbacks to run for any cleanup or destruction behavior. The scope of this destruction depends on where DestroyRef is injected. This new feature fits perfectly with the Angular composables and gives us the power to perform clean up tasks (e.g removing the event listener like in our example, unsubscribe from subscriptions) in our components, when the Component or Directive that uses it is destroyed. 

The same example can also be written using RxJS and the newly added `takeUntilDestroyed` operator under the `@angular/core/rxjs-interop` package:

```ts
export function useMouse() {
  // injectables
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);

  // state encapsulated and managed by the composable
  const x = signal(0);
  const y = signal(0);

  // a composable can update its managed state over time.
  function update(event: any) {
    x.update(() => event.pageX);
    y.update(() => event.pageY);
  }

  fromEvent(document, 'mousemove')
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(update);

  // expose managed state as return value
  return { x, y };
}
```

The `takeUntilDestroyed` operator completes the Observable when the component that uses the composable is destroyed.


### Sync LocalStorage Example

Another use case for the Angular Composables is when we want to automatically sync a signal with the local storage. For example we might want to save a user's theme preference to the local storage. To do this, we initialize a signal with the current value we have in the local storage. If there is a change in the component, for example the user selected another theme, an `effect` will observe this change and will set the new value in the local storage automatically. 

```ts
export function useLocalStorage(key: string) {
  // state encapsulated and managed by the composable
  const value = signal('');

  const serializedVal = localStorage.getItem(key);
  if (serializedVal !== null) {
    value.set(parseValue(serializedVal));
  }

  function handler(e: StorageEvent) {
    if (e.key === key) {
      const newValue = e.newValue ? parseValue(e.newValue) : null;
      value.set(newValue);
    }
  }

  window.addEventListener('storage', handler, true);

  effect(() => {
    localStorage.setItem(key, JSON.stringify(value()));
  });

  // lifecycle to teardown side effects.
  inject(DestroyRef).onDestroy(() =>
    window.removeEventListener('storage', handler)
  );

  // expose managed state as return value
  return { value };
}
```

This composable can be used in the component like this:

```ts
@Component({
  standalone: true,
  template: `
    <button (click)="useTheme('Dark')">Use dark theme</button>
    <button (click)="useTheme('Light')">Use light theme</button>

    <p>Stored used: {{ storage.value() }}</p>
  `,
})
export class LocalStorageComponent {
  storage = useLocalStorage('theme');

  useTheme(theme: 'Dark' | 'Light') {
    this.storage.value.set(theme)
  }
}
```

[Stackblitz](https://stackblitz.com/edit/angular-2kiv4w-s3krxr?file=src/app/composables/storage.ts)

### Async State Example

The next example is a data fetching composable. When we do an HTTP request, we need to describe different states of this request in our components (e.g Loading, Error, Success). We might also want to re-fetch the data automatically, when one parameter in the url changes. We don't want to replicate the logic for the different states or the logic for the re-fetch on every component. We can extract this logic to a composable, as you can see in the following snippet.

```ts
export function useFetch<D>(url: Signal<string>) {
  const data = signal<D | null>(null);
  const error = signal<Error | null>(null);

  async function doFetch() {
    const urlValue = url();

    try {
      // artificial delay / random error
      await timeout();

      const res = await fetch(urlValue);
      data.set(await res.json());
      error.set(null);
    } catch (e) {
      data.set(null);
      error.set(e as Error);
    }
  }

  effect(doFetch);

  return { data, error, retry: doFetch };
}
```

Which can be used in the component like this:

```ts
@Component({
  standalone: true,
  template: `
    ...
      <p>Oops! Error encountered: {{ fetch.error()?.message }}</p>
      <button (click)="fetch.retry()">Retry</button>
    ...
  `,
  imports: [NgFor, JsonPipe, NgIf],
})
export class UsersComponent {
  ...
  url = computed(() => baseUrl + this.id());

  fetch = useFetch(this.url);
}
```

[Stackblitz](https://stackblitz.com/edit/angular-2kiv4w-s3krxr?file=src/app/composables/fetch.ts)

### Why not just use a service?

One thing I want to stress is that Angular Composables is not a replacement of Angular services. We don't want to lose the superpowers the Angular DI system offers us. However, what I want the outcome of this article to be, is that using a service is not always the best way or the only way to extract stateful logic from your components. 

Angular Composables should contain the stateful logic for a very specific thing. Sometimes we see that Angular services tend to become complex files including the logic for many different things. If we want to isolate a specific logic in a component which can be used from other components, then maybe we should consider adding a composable. They can be a nice tool for the local state management of our components. They are very flexible, can be nested into each other and can be treated as isolated units that enable us to compose more complex logic.

Angular composables require less boilerplate than services and of course less knowledge of Angular features (Injectable/providers).

The examples can be found on [Github](https://github.com/stefanoslig/angular-composables-demo) and on [Stackblitz](https://stackblitz.com/edit/angular-2kiv4w-s3krxr)

Thank you for reading ♡
