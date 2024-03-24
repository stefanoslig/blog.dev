---
title: 'How to organize your libs in a nrwl/nx monorepo'
excerpt: 'In this article you can find a real world example and a short explanation of how you can organize the libs in an Angular nrwl/nx monorepo'
coverImage: '/assets/blog/organize-your-libs-in-nx-monorepo/building-blocks.jpeg'
date: '2022-04-22T05:35:07.322Z'
author:
  name: Stefanos Lignos
  picture: '/assets/my-photo-2.jpg'
ogImage:
  url: '/assets/blog/organize-your-libs-in-nx-monorepo/building-blocks.jpeg'
---


In this article you can find a real world example and a short explanation of how you can organize the libs in an Angular nrwl/nx monorepo. You can find the code on the following [Github](https://github.com/stefanoslig/organize-nx-libs-article-demo) repository.

In this project, there is one app (learning-cube) which consumes the libraries under the libs folder. 

The folder structure is:
~~~
libs 
	> learnings
		> data-access
		> feature-list
		> feature-search
		> feature-shell
		> utils-testing
	> shared
		> data-access
		> ui
		> api-types
	> users
		> data-access
		> feature-list
		> feature-search
		> feature-shell
		> utils-testing
~~~

I used two classifiers to name my libraries. The first classifier is the **scope** and the second the **type**. The main reason is that I want every developer when he looks at a library to understand where this library can be used and which kind of services/components/etc it contains. 

The **scope** is the section (domain) of the app the library can be used for. In this project, the scope is a section of the app since I have only one app. In a repository with more than one app, the scope can be each one of these apps. The **scope** gives a clear indication that a feature belongs to a specific domain. For example the libraries under the **learnings** scope, are used in the learnings page, the libraries under the **users** scope in the users page and the libraries under the **shared** scope can be reused between all the sections of the app.

The **type** indicates the purpose of a library. I have used 5 different types (feature, data-access, ui, feature-shell, utils). The **feature-...** type contains smart components. These are components which enable the communication with the data-sources (most likely they inject api services). The **data-access** type contains code for interacting with the server. An example from the **users-data-access** library is:
~~~
users
	> data-access
		> learnings-api.service
		> learnings-store.service
~~~ 

The **ui** type contains dumb (presentational) components. These components are reusable in the scope of this library. In this project we have a **ui** library only in the shared folder. The components of this library can be used with every other library. However, we could also have domain specific presentational components. In this case, the **ui** library would be under the **learnings** or **users** scope and could be used only in the libraries that belong to this domain.

The **feature-shell** is the glue between the **feature-...** libs and most likely is a lazy loaded module. In this project, they are lazy loaded modules (you can see it in the **app-routing.module** file).  

The **utils** libraries are used here to keep some mock data and services for the testing. Generally they contain low level code used by all the other libraries in the same scope.

That was an example of how you can organize your libraries in a nrw/nx monorepo. I hope you found it useful.


