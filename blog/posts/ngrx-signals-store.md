---
title: 'All you need to know to get started with the NgRx Signal Store'
excerpt: 'In this article, we explore the NgRx Signal Store, a new state management solution for Angular Signals, offering simplicity, scalability, and minimal boilerplate.'
coverImage: '/assets/blog/ngrx-signals-store/ngrx-signal-store.png'
date: '2024-01-08T05:35:07.322Z'
author:
  name: Stefanos Lignos
  picture: '/assets/my-photo-2.jpg'
ogImage:
  url: '/assets/blog/ngrx-signals-store/ngrx-signal-store.png'
---

## Introduction

When the Angular team introduced the signals API, I started thinking about what a nice solution for the state management of signals would look like. I had the hope that the emerging solution would be a thin layer on top of Angular signals, providing the necessary tools for working with them in a structured and scalable way while minimizing boilerplate. Having worked with [Pinia](https://pinia.vuejs.org/) in the past, the official state management solution for Vue.js, I really liked its simplicity and modularity. Pinia has only a few core concepts and a very compact API which makes it super easy to start working with. 

So, I was positively surprised when I saw the [NgRx SignalStore RFC](https://github.com/ngrx/platform/discussions/3796) from the NgRx team some months ago. It strongly resembled the simplicity, scalability, and structure of a Pinia store. After several months of development and community discussions based on the RFC, the NgRx team released the first version of the NgRx Signal Store package, now in developer preview. The result made me very enthusiastic about it. In the following sections, I aim to provide you with all the necessary knowledge to start working and experimenting with this library.

## Overview of the NgRx Signal Store

The new NgRx Signal Store is an all-in-one functional state management solution for Angular Signals. As you can see in the following diagram, the API for the Signals Store is quite compact. You can create a store using the `signalStore` function. You can handle simple pieces of state using the `signalState`. You can extend the core functionality with custom features using the `signalStoreFeature`. You can integrate RxJS using the `rxMethod` and you can manage entities using the `withEntities` feature. That's it. If you need additional functionality it's super simple to extend it with custom features (which we will explore in one of the next sections).

![ngrx signals structure](/assets/blog/ngrx-signals-store/ngrx-signal-store-structure.png)

The simplest example of creating a store is:

```ts
import { signalStore, withState } from '@ngrx/signals';

export const HelloStore = signalStore(
  withState({ firstName: 'John', lastName: 'Doe' })
);
```

and this can be used in the components like this: 

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HelloStore } from './hello.store';

@Component({
  selector: 'app-hello',
  standalone: true,
  template: `
    <h1>Hello {{ helloStore.firstName() }}!</h1>
  `,
  providers: [HelloStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HelloComponent {
  readonly helloStore = inject(HelloStore);
}
```

After considering this example, you might be wondering why the NgRx team decided to adopt a more functional approach in comparison to the class-based approach used in the ComponentStore, for instance. A few months ago, in the NgRx repository, there was an [RFC](https://github.com/ngrx/platform/discussions/3769) discussing a new method to create custom NgRx ComponentStore without using a "class-based" approach but instead using a function. I believe this also explains their decision to embrace a functional approach for the new NgRx Signal Store. Their arguments in favor of the more functional approach, outlined in that RFC, were as follows:

> There are several community ComponentStore plugins - ImmerComponentStore, EntityComponentStore, etc. However, in JS/TS, a class can only extend one class by default and without additional hacks. What if we want to create a ComponentStore that reuses entity features but also has immer updaters? With the createComponentStore function, I see the possibility of combining reusable features in a more flexible way.
>
> Easier scaling into multiple functions if needed.
>
> With the "class-based" approach, ComponentStores that use onStoreInit and/or onStateInit hooks must be provided by using the provideComponentStore function. This won't be necessary with the createComponentStore function.

Indeed, as we will see in the next sections, it's super easy to extend the functionality of the new NgRx Signal Store with custom features, to compose features and to split the code. Also, something not mentioned in the above RFC is that the code becomes more tree-shakeable.

## How the NgRx Signals Store works

### signalStore

Conceptually the `signalStore` function is similar to the RxJS `pipe` function. The `pipe` function takes pipeable operators as arguments, it first performs the logic of the first pipeable operator and then uses that value to execute the logic of the next pipeable operator, and so on. In this way, we define the behavior of a stream. Similarly, the `signalStore` function takes `store feature functions` (such as `withState`, `withComputed`, `withHooks`, etc.) as input arguments. It will first perform the logic of the first `store feature function` and then uses that value to execute the logic of the next feature function and so on. In this way, we define the intended behavior of our store.

```ts
import { computed } from '@angular/core';
import { signalStore, withComputed, withState } from '@ngrx/signals';

export const HelloStore = signalStore(
  withState({ firstName: 'John', lastName: 'Doe' }),
  withComputed(({ firstName, lastName }) => ({
    name: computed(() => `${firstName()} ${lastName()}`),
  }))
);
```

Let's explore what happens internally when we call the `signalStore` function. The first thing that happens is that an `injectable service` will be created. This service is what the `signalStore` function returns. Depending on the configuration we have provided, Angular will provide the service in the root injector making it available throughout the application (global state) or we will need to provide it in a specific component (local state).

![ngrx signals store injectable](/assets/blog/ngrx-signals-store/signal-store-injectable.png)

In the constructor of the created class, the `store features` we have provided will start executing one by one in the specified order. The sequence of features depends on the functionality you desire, progressing from the previous feature to the next. For instance, if you wish to utilize a method declared in the `withMethods` feature within the `withHooks` method, you must include `withMethods` first in the order.

![ngrx signals store features execution](/assets/blog/ngrx-signals-store/features-execution-2.png)

There are 5 core features provided to us from NgRx. Let's explore what each one of them does: 

### withState

We use the `withState` feature to define the shape and the value of our state in the store. For example we could define the value of a `UserStore` like this:

```ts
export const UserStore = signalStore(
  { providedIn: 'root' },
  withState({
    user: {
      firstName: 'John',
      lastName: 'Doe',
      age: 25,
      address: {
        id: 1,
        country: 'UK',
      },
    },
    settings: {
      allowAutoSync: false,
    },
  })
);
```

The `withState` function will create a nested signal for us. This means that we can access any property of the state, regardless of its depth, in our components or in our code, just as we would for any other signal. For example, with the above store, we can display the user's country like this:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UserStore } from './user.store';

@Component({
  selector: 'app-user',
  standalone: true,
  template: `
    <h1>Country: {{ userStore.user.address.country() }}!</h1>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class UserComponent {
  readonly userStore = inject(UserStore);
}
```

Because internally the `withState` feature function uses a `Proxy` to create the nested signal, the signal for every property (which, in reality, is a `computed`) will be created lazily, only when we try to access the propery. This improves the overall performance in cases where we only need to observe a small subset of the state properties (for instance, if we have stored the result of an HTTP call in the store, and we only need to read specific properties). Additionally, if the nested signal has already been accessed(created), it won't be created again when we try to access it for a second time.

As mentioned earlier, the features are executed in the order we have specified when calling the signalStore function. Each of them is a factory which returns a function which internally will be executed with the store as an argument as it is defined up to the point of its execution. This means that if the store already contains a method or a state slice or a computed entry with the same key as the keys of the state we define with the `withState` feature, the latter will override previously defined state slices, computed, and methods with the same name. This is illustrated in the following diagram.  

![ngrx signals store features execution](/assets/blog/ngrx-signals-store/with-state-remove-same-keys-3.png)

Because unintentional overriding might lead to issues that are difficult to detect, the NgRx team might soon improve the developer experience by showing a warning or an error when this happens  (open [issue](https://github.com/ngrx/platform/issues/4144)).

### withMethods

The withMethods feature enable us to add methods in our store. This can be the public API of our store. Inside these methods, we can update our state using the `patchState` utility function or we can integrate RxJS using the `rxMethod`, or you can add any other logic you want to perform in this method. Similarly to the `withState`, it will override previously defined state slices and computed properties with the same name. 

Examples of `withMethods` usage:

```ts
export const HelloStore = signalStore(
  withState({ firstName: 'John', lastName: 'Doe' }),
  withMethods((store) => ({
    changeFirstName(firstName: string) {
      patchState(store, { firstName });
    },
  })),
);
```

```ts
export const ArticleStore = signalStore(
  { providedIn: 'root' },
  withState<ArticleState>(articleInitialState),
  withMethods(
    (
      store,
      articlesService = inject(ArticlesService),
      actionsService = inject(ActionsService),
      router = inject(Router),
    ) => ({
      getArticle: rxMethod<string>(
        pipe(
          switchMap((slug) =>
            articlesService.getArticle(slug).pipe(
              tapResponse({
                next: ({ article }) => {
                  patchState(store, { data: article });
                },
                error: () => {
                  patchState(store, { data: articleInitialState.data });
                },
              }),
            ),
          ),
        ),
      ),
  ...
  ...
```
***You can find the full implementation of the above store [here](https://github.com/stefanoslig/angular-ngrx-nx-realworld-example-app/blob/main/libs/articles/data-access/src/lib/article.store.ts)***


### patchState

The patchState utility function provides a type-safe way to perform immutable updates on pieces of state. Due to a recent change to the default equality check function in signals in Angular 17.0.0-next.8 release, it is important to make sure that we update the values of the nested signals of our state in an immutable way. That's because in the new default equality check of the Angular signals, objects are checked by reference. Therefore, if you return the same object, just mutated, your signal will not send a notification indicating that it has been updated. The `patchState` function helps us with this.

### withComputed

By utilizing the `withComputed` feature, we can define derived state within our store—state calculated based on one or more slices of our existing state. Similarly to the `withState` and the `withMethods` features, it will override previously defined state slices and methods with the same name.

Examples of `withComputed` usage:

```ts
export const HelloStore = signalStore(
  { providedIn: 'root' },
  withState({ firstName: 'John', lastName: 'Doe' }),
  withComputed(({ firstName }, articlesService = inject(AddressStore)) => ({
    name: computed(() => firstName().toUpperCase()),
    nameAndAddress: computed(
      () => `${firstName().toUpperCase()} ${articlesService.address()}`
    ),
  })),
  ...
  ...
```

### withHooks

In case we want to perform specific actions when the store is created or destroyed like calling one of the methods we have defined previously in the `withMethods` feature or performing some clean-up logic, we can use the `withHooks` feature.

Example of `withHooks` usage:

```ts
export const HelloStore = signalStore(
  withState({ firstName: 'John', lastName: 'Doe' }),
  withComputed(({ firstName }, articlesService = inject(AddressStore)) => ({
    name: computed(() => firstName().toUpperCase()),
    nameAndAddress: computed(
      () => `${firstName().toUpperCase()} ${articlesService.address()}`
    ),
  })),
  withMethods((store) => ({
    changeFirstName(firstName: string) {
      patchState(store, { firstName });
    },
  })),
  withHooks(({ firstName, changeFirstName }) => {
    return {
      onInit() {
        changeFirstName('Nick');
      },
      onDestroy() {
        console.log('firstName on destroy', firstName());
      },
    };
  })
);
```

## Customs features

One of the biggest strengths of the new NgRx Signal Store is its extensibility. In addition to utilizing the core features provided by the library (withEntities, withState, withMethods, withHooks, withComputed), you can easily create your own custom features to enhance the library's capabilities and functionality based on your specific needs. Of course, this gives also the chance to the community to start creating custom features that can be seamlessly integrated alongside the core features. One of the best examples so far is the [ngrx-toolkit](https://github.com/angular-architects/ngrx-toolkit) library which provides already a lot of useful custom features like `withDevtools`, `withRedux`, `withDataService`, `withCallState`, `withUndoRedo`, etc. In the next sections we're going to create our own custom feature (withClipboard).

The NgRx Signal Store can be fully extended. Here is a list of things you can do with a custom feature:

- Add new properties to stores
- Add new methods to stores
- Add new computed to stores
- Specify which properties a store should contain in order to be possible to use them in a store.
- Re-use the same functionality accross different stores

You can create a custom feature using the `signalStoreFeature` function. Similarly to the `signalStore` function, it takes one or more core or custom features as input argument(s). It will first execute the logic of the first provided feature and then use that value to execute the logic of the next feature function and so on. One of the simplest examples of a custom feature is the following `withClipboard` feature. It enables you to copy text to the clipboard and saves the copied text in the store.

```ts
...
import { Clipboard } from '@angular/cdk/clipboard';

export interface ClipboardState {
  text: string;
  copied: boolean;
}

export interface ClipboardOptions {
  resetCopiedStateAfter?: number;
}

export function withClipboard(options?: ClipboardOptions) {
  return signalStoreFeature(
    withState<ClipboardState>({ text: '', copied: false }),
    withMethods((store, clipboard = inject(Clipboard)) => ({
      copy(value: string) {
        clipboard.copy(value);

        if (options?.resetCopiedStateAfter) {
          setTimeout(
            () => patchState(store, { copied: false }),
            options?.resetCopiedStateAfter
          );
        }
        patchState(store, { text: value, copied: true });
      },
    }))
  );
}
```

Now this custom feature can be used from any store in our application like this: 

```ts
export const HelloStore = signalStore(
  { providedIn: 'root' },
  withState({ firstName: 'John', lastName: 'Doe', phone: '616333843' }),
  withComputed(({ firstName, lastName, phone }) => ({
    nameAndPhone: computed(() => `${firstName} ${lastName} ${phone}`),
  })),
  withClipboard({ resetCopiedStateAfter: 1500 })
);
```

![gif example](/assets/blog/ngrx-signals-store/ezgif.com-video-to-gif-converter.gif)

You can find the example here: [Stackblitz](https://stackblitz.com/edit/stackblitz-starters-s3qcsd?file=src%2Fmain.store.ts)

Most likely you have already understood the problem with the above custom feature. If I want to save the ***copied*** status for more than one elements in the page in the same store, it's not possible with the current implementation of the feature. When you start working with the NgRx Signal Store and with the custom features, one of the first problems you will encounter is how you can use the same custom feature multiple times in the same store. The solution for this is very nicely explained in an [article from Manfred Steyer](https://www.angulararchitects.io/en/blog/ngrx-signal-store-deep-dive-flexible-and-type-safe-custom-extensions/). In the next paragraph I will show how we can re-implement the above custom feature so it can be used many times in the same store so we can save the status of different elements in the page. What we need to implement is  a custom feature with dynamic properties.

In the end, we should be able to prefix the slices of the custom feature's state with a dynamic property. This way, we can avoid naming collisions in the state slices. For the same reason, we also want to prefix the methods.

![custom-feature-dynamic-properties](/assets/blog/ngrx-signals-store/custom-feature-dynamic-properties.png)

To do this, we need to inform the type system about our intention to return prefixed slices and methods in the custom `SignalStoreFeature`. We do this by providing the following types:

```ts
export interface ClipboardOptions<Prop> {
  prefix: Prop;
  resetCopiedStateAfter?: number;
}

export type PrefixedClipboardState<Prop extends string> = {
  [K in Prop as `${K}Text`]: string;
} & {
  [K in Prop as `${K}Copied`]: boolean;
};

export type PrefixedClipboardMethods<Prop extends string> = {
  [K in Prop as `${K}Copy`]: (value: string) => {};
};

export function withClipboard<Prop extends string>(
  options: ClipboardOptions<Prop>
): SignalStoreFeature<
  { state: {}; signals: {}; methods: {} },
  {
    state: PrefixedClipboardState<Prop>;
    signals: {};
    methods: PrefixedClipboardMethods<Prop>;
  }
>;
```

And the actual implementation of the `withClipboard` feature should include the prefixed slices and methods:

```ts
export function withClipboard<Prop extends string>(
  options: ClipboardOptions<Prop>
): SignalStoreFeature {
  const { textKey, copiedKey } = getClipboardStateKeys(options.prefix);
  const { copyKey } = getClipboardMethodsKeys(options.prefix);

  return signalStoreFeature(
    withState({ [textKey]: '', [copiedKey]: false }),
    withMethods((store, clipboard = inject(Clipboard)) => ({
      [copyKey](value: string) {
        clipboard.copy(value);

        if (options?.resetCopiedStateAfter) {
          setTimeout(
            () => patchState(store, { [copiedKey]: false }),
            options?.resetCopiedStateAfter
          );
        }
        patchState(store, { [textKey]: value, [copiedKey]: true });
      },
    }))
  );
}
```

And this is how we can use it in the store:

```ts
export const HelloStore = signalStore(
  { providedIn: 'root' },
  withState({ firstName: 'John', lastName: 'Doe', phone: '616333843' }),
  withComputed(({ firstName, lastName, phone }) => ({
    nameAndPhone: computed(() => `${firstName} ${lastName} ${phone}`),
  })),
  withClipboard({ prefix: 'firstName', resetCopiedStateAfter: 1500 }),
  withClipboard({ prefix: 'lastName', resetCopiedStateAfter: 1500 }),
  withClipboard({ prefix: 'phone', resetCopiedStateAfter: 1500 })
);
```

Now we can see that each element in the page has its own slice in the store.

![gif example](/assets/blog/ngrx-signals-store/ezgif.com-video-to-gif-converter-2.gif)

You can find the full implementation here: [Stackblitz](https://stackblitz.com/edit/stackblitz-starters-2ea27n?file=src%2Fmain.store.ts)

## RxMethod

Even when working with signals, integrating RxJS into our code can give us extra powers. The `rxMethod` is a standalone factory function that helps us create reactive methods. It returns a function that accepts a static value, signal, or observable as an input argument. If a static value is provided as input, the returned method will be executed only once. If a signal is provided, then it will be re-executed every time the signal notifies that it changed, and when an observable is provided, it will be re-executed every time the observable emits a value.

Example:

```ts
withMethods((store) => ({
  logIntervals: rxMethod(
    pipe(
      filter((num) => num % 2 === 0),
      tap((val) => console.log(`Even number: ${val}`))
    )
  ),
})),
```

In the following component, a new message will be logged every time the `myNumberSignal` signal changes.

```ts
export class ExampleComponent {
  readonly helloStore = inject(HelloStore);
  readonly myNumberSignal = signal(0);

  constructor() {
    interval(1000).subscribe((value) => this.number.set(value));

    this.helloStore.logIntervals(this.number);  
  }
}
```

## Conclusion

If you already use NgRx in a project, I would suggest starting to work with the NgRx Signal Store for introducing new stores. You can easily combine the NgRx Store and the NgRx Signal Store ([example](https://github.com/stefanoslig/angular-ngrx-nx-realworld-example-app/blob/main/libs/articles/data-access/src/lib/article.store.ts#L121)). For a new project, I would strongly suggest starting to work directly with the NgRx Signal Store for state management. This is because it can dramatically reduce boilerplate and, of course, has full support for working with Angular Signals in a structured way.

## Useful links - examples:
- [Example app using NgRx Signal Store - currently migrating from NgRx Store to NgRx Signal Store](https://github.com/stefanoslig/angular-ngrx-nx-realworld-example-app/blob/main/libs/articles/data-access/src/lib/article.store.ts)
- [Stackblitz custom feature - withClipboard](https://stackblitz.com/edit/stackblitz-starters-s3qcsd?file=src%2Fmain.store.ts)
- [Stackblitz custom feature dynamic properties - withClipboard](https://stackblitz.com/edit/stackblitz-starters-2ea27n?file=src%2Fmain.store.ts)
- [Other custom features - NgRx toolkit library](https://github.com/angular-architects/ngrx-toolkit)


> **_Bibliography_**
> 
> \[1\]:RFC: NgRx SignalStore [https://github.com/ngrx/platform/discussions/3796](https://github.com/ngrx/platform/discussions/3796)
>
> \[2\]:Signals Store docs [https://ngrx.io/guide/signals/signal-store](https://ngrx.io/guide/signals/signal-store)
>
> \[3\]:RFC: Add createComponentStore Function [https://github.com/ngrx/platform/discussions/3769](https://github.com/ngrx/platform/discussions/3769)
