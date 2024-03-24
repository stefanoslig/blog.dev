---
title: 'Testing functional resolvers and guards in Angular'
excerpt: 'In this article we are going to explore all the different ways we can test functional guards and resolvers in an Angular project.'
coverImage: '/assets/blog/testing-functional-guards-and-resolvers/testing-functional-resolvers.png'
date: '2023-03-21T05:35:07.322Z'
author:
  name: Stefanos Lignos
  picture: '/assets/my-photo-2.jpg'
ogImage:
  url: '/assets/blog/testing-functional-guards-and-resolvers/testing-functional-resolvers.png'
---

### Introduction

In version [14.2.0](https://github.com/angular/angular/blob/main/CHANGELOG.md#1420-2022-08-25), Angular allowed guards and resolvers to be plain functions. In version [15.2.0](https://github.com/angular/angular/blob/main/CHANGELOG.md#1520-2023-02-22), the Angular team deprecated Class and `InjectionToken` guards and resolvers. Of course, we will still be able to use class-based guards and resolvers if we would like to. The way to do this is by using some helper functions (`mapToCanMatch` or `mapToCanActivate`). All the provided helper functions can be found [here](https://github.com/angular/angular/blob/main/packages/router/src/utils/functional_guards.ts).

In spite of the fact that we can still use both ways of authoring our resolvers and guards, there is, in my opinion, a subtle preference in the Angular team for the functional approach. During this transition from the class-based to the functional approach, while taking into account the fact that a lot of developers working with Angular are not yet fully familiarized with the `inject()` function, I imagine there will be some questions on how we write unit tests for the  functional resolvers and guards.

Here is a list of all the different ways we can write these unit tests. Different versions of Angular give us different capabilities to do that. I tried to include all of them. In all of these cases, the error we try to avoid is the following one:

> NG0203: `inject()` must be called from an injection context such as a constructor, a factory function, a field initializer, or a function used with `EnvironmentInjector#runInContext`.

### Testing functional resolvers and guards (The hacky way)

The first way we're going to show is quite hacky and not recommended since there are better solutions at the moment. In this solution, we simply create a helper class `ResolverTestService`. We call the functional resolver inside this class. In this way, if we have any dependencies injected using the `inject` function inside the resolver, we make sure that the injection context is available when we call the resolver. 

```ts
describe('heroResolver', () => {
  let service: ResolverTestService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ResolverTestService,
        { provide: HeroService, useValue: { getHero: () => of(mockHero) } },
      ],
    });

    service = TestBed.inject(ResolverTestService);
  });

  it('should return the requested hero', () => {
    const result = service.resolverUnderTest;
    expect(result).toBeObservable(cold('(a|)', { a: mockHero }));
  });
});

@Injectable()
class ResolverTestService {
  constructor(private readonly heroService: HeroService) {}

  resolverUnderTest = ResolverUnderTest.heroResolver(
    mockRoute,
    {} as RouterStateSnapshot
  );
}
```

[stackblitz](https://stackblitz.com/edit/angular-2kiv4w?file=src/app/hero-detail/hero-detail.resolver.spec.ts)

### Testing functional resolvers and guards (No Testbed required)

The second way to test a resolver or a guard doesn't require using `TestBed`. To do this, we need to modify the resolver or the guard a little bit, so it can accept the injectable(s) as a parameter with a default value. To do this we need to extract the main logic of the resolver or guard in a separate function as you can see in the following code snippet.

```ts
export const heroResolver: ResolveFn<Hero> = (
  route: ActivatedRouteSnapshot
) => {
  return heroResolverFn(route);
};

export const heroResolverFn = (
  route: ActivatedRouteSnapshot,
  heroService = inject(HeroService)
) => {
  return heroService.getHero(route.params['id']!);
};
```

And now in the test we can pass as the parameter (instead of the default value) a mocked value for the dependency:

```ts
const mockRoute = { params: { id: 100 } } as unknown as ActivatedRouteSnapshot;
const mockHero: Hero = { name: 'Stef lig', id: 100 };
const mockHeroService = {
  getHero: () => of(mockHero),
} as unknown as HeroService;

describe('heroResolver', () => {
  let resolverFn: Observable<Hero>;

  beforeEach(() => {
    resolverFn = ResolverUnderTest.heroResolverFn(mockRoute, mockHeroService);
  });

  it('should return the requested hero', () => {
    expect(resolverFn).toBeObservable(cold('(a|)', { a: mockHero }));
  });
});

```

[stackblitz](https://stackblitz.com/edit/angular-2kiv4w-t4vxhd?file=src/app/hero-detail/hero-detail.resolver.spec.ts)

### Testing functional resolvers and guards (recommended way - Angular version 14.1 - 15.1)

In version `14.1.0`, the Angular team introduced the `EnvironmentInjector.runInContext` method as a handy way to run a function in the context of the injector. In our test, we can use this method after injecting the `EnvironmentInjector` class.

```ts
const mockRoute = { params: { id: 100 } } as unknown as ActivatedRouteSnapshot;
const mockHero: Hero = { name: 'Stef lig', id: 100 };

describe('heroResolver', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: HeroService, useValue: { getHero: () => of(mockHero) } },
      ],
    });
  });

  it('should return the requested hero', () => {
    const result = TestBed.inject(EnvironmentInjector).runInContext(() =>
      heroResolver(mockRoute, {} as RouterStateSnapshot)
    );
    expect(result).toBeObservable(cold('(a|)', { a: mockHero }));
  });
});
```

[stackblitz](https://stackblitz.com/edit/angular-2kiv4w-kjf7x5?file=src/app/hero-detail/hero-detail.resolver.spec.ts)

### Testing functional resolvers and guards (recommended way - Angular version > 15.1)

In version `15.1.0` the `EnvironmentInjector.runInContext` was deprecated, in favor of the Add `TestBed.runInInjectionContext` to help test functions that use `inject` ([#47955](https://github.com/angular/angular/pull/47955)). So, we can write our tests like this:

```ts
it('should return the requested hero', () => {
    const result = TestBed.runInInjectionContext(() =>
      heroResolver(mockRoute, {} as RouterStateSnapshot)
    );
    expect(result).toBeObservable(cold('(a|)', { a: mockHero }));
  });
```

[stackblitz](https://stackblitz.com/edit/angular-2kiv4w-s4bhsp?file=src/app/hero-detail/hero-detail.resolver.spec.ts)

### Testing functional resolvers and guards (recommended way - using runInInjectionContext - after 16.0.0-next.3)

In version `16.0.0-next.3`, a new standalone function (`runInInjectionContext`) was added so we can run a function with access to inject tokens from any injector (not only the `EnvironmentInjector`). So the above test can also be written using this standalone API.

```ts
  it('should return the requested hero', () => {
    const result = runInInjectionContext(
      TestBed.inject(EnvironmentInjector),
      () => heroResolver(mockRoute, {} as RouterStateSnapshot)
    );
    expect(result).toBeObservable(cold('(a|)', { a: mockHero }));
  });
```


> **_Bibliography_**
> 
> \[1\]: [https://github.com/angular/angular/pull/47924](https://github.com/angular/angular/pull/47924)
> 
> \[2\]: [https://github.com/angular/angular/blob/main/CHANGELOG.md](https://github.com/angular/angular/blob/main/CHANGELOG.md)