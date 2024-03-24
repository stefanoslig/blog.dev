---
title: 'Synchronizing app state across iframes using NgRx and the Broadcast Channel API'
excerpt: 'In this article, we are going to see how we can use the Broadcast Channel API to synchronize an application state across iframes.'
coverImage: '/assets/blog/synchronizing-app-state-across-iframes/main-photo.jpeg'
date: '2022-09-18T05:35:07.322Z'
author:
  name: Stefanos Lignos
  picture: '/assets/my-photo-2.jpg'
ogImage:
  url: '/assets/blog/synchronizing-app-state-across-iframes/main-photo.jpeg'
---

In this article we're going to see how we can use the [Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) to synchronize an application's state across iframes. Our use case, which I'm going to describe in the next paragraph, includes iframes, however, the synchronization can happen between any [Browsing context](https://developer.mozilla.org/en-US/docs/Glossary/Browsing_context) (tabs, windows, frames).

### Our use case

One of the projects we build in my company is an add-in for Outlook on the web. With this add-in, we help people to work more securely in their Office 365 mail environment and we prevent data leaks through encryption and contextual, machine-learning powered business rules. 

Our add-in is an Angular application using NgRx for its global state management. Due to the way in which Office 365 manages the add-ins, there are scenarios where 3 or even more instances of the same application can run in parallel in different iframes. In the picture below you can see a scenario like this. 

![iframes](/assets/blog/synchronizing-app-state-across-iframes/iframes-owa.png)

It might already be obvious that when you have 3 instances of the same application running in different iframes at the same moment, there is a need for communication between them. There are different approaches someone can take in order to achieve this. The simplest one is to store the information they want to share in the local storage. Then this information is available to each one of the running instances. The problem with this approach is that when you use a redux-based solution to store the global state of your app (we use NgRx), you then have two places where you save the same information. One is the local storage and the other one the NgRx store. Apart from breaking the single source of truth architecture of the app, following this approach would have the extra burden of keeping the NgRx store in sync with the local storage. 

So what if instead of sharing information between all the running instances using the local storage, we could just keep the NgRx store in sync between them? In the next paragraphs, I'm going to show you how we can keep the NgRx store in sync between multiple instances of the app, while running in iframes. We're going to use the Broadcast Channel API for this purpose.

### The solution in simple words

In applications using NgRx the only way to change the global state is through actions. Pure functions, which we call reducers, take the previous state and an action and they return the next state. Because of the fact that reducers are pure functions we can be sure that if we dispatch the same actions (actions without side effects) in the same order multiple times in an app, the value of the state at the end will be the same every time. That also means that if we have two instances of the same app running in parallel and in both we dispatch the same actions, both of them will end up having the same state. So, if we want to synchronize the state between two or three apps running in iframes, we need to make sure that the same actions will be dispatched to all of them. What if we had a way to share the dispatched actions from one app to any other instance of the app running in an iframe, or a tab, or a window? The actions are just plain objects. They can be serialized and shared in a communication channel.


In our case, the communication channel which we're going to use to share the actions is the Broadcast Channel API. When a broadcast channel is created, we can subscribe to it from any browsing context in the same origin and listen to messages posted to it. In the following image, we have the same application running in two iframes. Let's assume that this application uses NgRx. When the first instance of the application dispatches an action, this action will also be posted as a message to the broadcast channel. The second instance which has subscribed to this channel will listen to the message and when it receives it, it will dispatch the same action in this instance as well. As we described in the previous paragraph, when we have the same actions dispatched, we know for sure that the global state of the application will be the same and synchronized between all the running instances of the app.


![shared actions](/assets/blog/synchronizing-app-state-across-iframes/shared-actions.png)

### The code

For our solution, the first thing we have to do is to create a broadcast channel service. Using this service we can post messages to the broadcast channel. The messages we post are of type **Action**.

```ts
postMessage(message: Action): void {
  this.broadcastChannel.postMessage(message);
}
```

In this service we also listen for the posted messages in the broadcast channel and we pass them as values to a **Subject<Action>**. This **Subject** will be used later in the broadcast channel's effects.

```ts
this.broadcastChannel.onmessage = (message) =>
  this.ngZone.run(() => this._onMessage$.next(message.data));
```

And this is how the service looks like:

```ts
@Injectable({
  providedIn: 'root',
})
export class BroadcastChannelService implements OnDestroy {
  private readonly broadcastChannel!: BroadcastChannel;
  private readonly _onMessage$ = new Subject<Action>();
  readonly onMessage$ = this._onMessage$.asObservable();

  constructor(private readonly ngZone: NgZone) {
    this.broadcastChannel = new BroadcastChannel('broadcastChannelName');
    this.broadcastChannel.onmessage = (message) =>
      this.ngZone.run(() => this._onMessage$.next(message.data));
  }

  postMessage(message: Action): void {
    this.broadcastChannel.postMessage(message);
  }

  ngOnDestroy() {
    this.broadcastChannel.close();
  }
}
```


Let's see now how we can achieve the synchronization of the state. In the code, we have configured an Array of Actions that we want to listen to in the **broadcast-channel.effects.ts**. As we explained in a previous paragraph, these should be actions which don't have side effects. In my example application I have used an **InjectioToken** to setup this array of Actions so I can benefit from Angular's DI mechanism, but it can also be a simple variable.

```ts
{
  provide: BROADCAST_CHANNEL_ACTIONS,
  useValue: [
    lessonsActions.assignLessonSuccess,
    lessonsActions.deleteLessonSuccess,
    studentsActions.addStudentSuccess,
    studentsActions.deleteStudentSuccess,
  ],
},
```

Every time we dispatch one of these actions, the **broadcast-channel.effects** will listen to it and then we're going to post a message with the Action as the payload. To post the message to the broadcast channel we use the **postMessage** method from the **broadcast-channel.service.ts**. 

```ts
broadcastActions$ = createEffect(
  () =>
    this.actions$.pipe(
      ofType(...this.bcActions),
      tap((action) => this.bcService.postMessage(action))
    ),
  { dispatch: false }
);
```

Since we have posted this message to the broadcast channel, every application which runs in an iframe and has subscribed to this channel, will listen to this message and will push the value of the message to the **onMessage$ Subject**. We know that the value of the message will be always an **Action**. In the effects we have subscribed to the **onMessage$ Subject** and when it emits its value, we are going to dispatch the same Action so it can be listened to from the relevant reducer.

```ts
onMessage$ = createEffect(() =>
  this.bcService.onMessage$.pipe(
    map((action) => ({
      ...action,
      type: `[Broadcasted ${action.type.replace(/\[/g, '')}`,
    }))
  )
);
```

To avoid an infinite loop because of the **broadcastActions$** effect, we add the word **Broadcasted**  in the type of the Action we dispatch from the **onMessage$** effect.

Now the reducer will also listen to this **Action** and will update the store accordingly.

```ts
on(
  { type: '[Domain] my action', { payload } },
  { type: '[Broadcasted Domain] my action', { payload } },
  ...
  ...
```

### Requesting the initial state

There is one missing piece in this solution. What if we have two iframes but the application in the second iframe started running after some actions have already been dispatched in the first iframe? That means that the application in the second iframe won't have the same initial state as the one in the first iframe. Even if we dispatch the same actions in both of them using the mechanism we already implemented, the final state won't be the same.

The idea to solve this problem is very simple. When an application in the second iframe starts running, it will dispatch an action to request the initial state in case there are already applications running on different iframes. Using the same effect as before, this action will be posted to the broadcast channel. If there is another application running on a different iframe, it will listen to this action using a specific effect. Then in this effect, we select the current state from the store and we send it back as the payload of an action. The iframe which asked for the initial state will listen to this action and a meta-reducer will set the initial state based on the state which is returned as the payload.


![initial state](/assets/blog/synchronizing-app-state-across-iframes/initial-state.png)

After the required changes to retrieve the initial state, the effects should look like this:

```ts
export class BroadcastChannelEffects implements OnInitEffects {
  broadcastActions$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          ...this.bcActions,
          broadcastChannelActions.requestInitialState,
          broadcastChannelActions.sendBackInitialState
        ),
        tap((action) => this.bcService.postMessage(action))
      ),
    { dispatch: false }
  );

  onMessage$ = createEffect(() =>
    this.bcService.onMessage$.pipe(
      filter(
        ({ type }) => type !== broadcastChannelActions.requestInitialState.type
      ),
      map((action) => ({
        ...action,
        type: `[Broadcasted ${action.type.replace(/\[/g, '')}`,
      }))
    )
  );

  onRequestInitialState$ = createEffect(() =>
    this.bcService.onMessage$.pipe(
      ofType(broadcastChannelActions.requestInitialState),
      concatLatestFrom(() => this.store.select((state) => state)),
      map(([, state]) =>
        broadcastChannelActions.sendBackInitialState({ state })
      )
    )
  );

  ngrxOnInitEffects() {
    return broadcastChannelActions.requestInitialState();
  }
```

And this is the required meta-reducer whose job is to get the requested intial state and populate the store with it.

```ts
export function bcStateInitializer(
  reducer: ActionReducer<StateObject>
): ActionReducer<StateObject> {
  return function (state, action) {
    if (action.type === broadcastedChannelActions.sendBackInitialState.type) {
      return (action as BcAction).state;
    }

    return reducer(state, action);
  };
}
```

And that's all...now you should be able to synchronize the state betweeen iframes/windows/tabs. Personally I like this solution because it offers a very simple mental model, makes the code predictable, easy to reason about and it scales quite well. 

![demo gif](/assets/blog/synchronizing-app-state-across-iframes/demo.gif)

Feel free to check the demo app I created for this article in this [Github repo](https://github.com/stefanoslig/broadcast-channel-ngrx-demo).







