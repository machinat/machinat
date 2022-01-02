import invariant from 'invariant';
import {
  MACHINAT_SERVICE_PROVIDER,
  MACHINAT_SERVICE_CONTAINER,
  MACHINAT_SERVICE_INTERFACE,
} from '../symbol';
import type {
  ServiceLifetime,
  ServiceContainer,
  ServiceProvider,
  ServiceInterface,
  PolymorphicServiceInterface,
  MultiServiceInterface,
  SingularServiceInterface,
  ServiceDependency,
  ResolveDependencies,
} from './types';
import { polishServiceRequirement } from './utils';

const validateLifetime = (lifetime: string) => {
  invariant(
    lifetime === 'singleton' ||
      lifetime === 'scoped' ||
      lifetime === 'transient',
    `${lifetime} is not valid service lifetime`
  );
};

type ServiceFactoryFn<T, Deps extends readonly ServiceDependency<any>[]> = (
  ...args: ResolveDependencies<Deps>
) => T;

type ContainerOptions<Deps extends readonly ServiceDependency<any>[]> = {
  /** The container name for debugging purpose */
  name?: string;
  /** The interfaces of the required dependencies */
  deps?: Deps;
};

/**
 * makeContainer marks a function as a container and annotate the dependencies.
 * @category Service Registry
 */
export const makeContainer =
  <Deps extends readonly ServiceDependency<any>[]>({
    name,
    deps = [] as any,
  }: ContainerOptions<Deps>) =>
  <T>(
    fn: ServiceFactoryFn<T, Deps>
  ): ServiceContainer<T, ResolveDependencies<Deps>> &
    ServiceFactoryFn<T, Deps> => {
    const requirements = deps.map(polishServiceRequirement);

    return Object.defineProperties(fn, {
      $$typeof: { value: MACHINAT_SERVICE_CONTAINER, configurable: true },
      $$name: { value: name || fn.name, configurable: true },
      $$deps: { value: requirements, configurable: true },
      $$factory: { value: fn, configurable: true },
    });
  };

type ClassProviderOptions<T, Deps extends readonly ServiceDependency<any>[]> = {
  /** The provider name for debugging purpose */
  name?: string;
  /** The interfaces of the required dependencies */
  deps?: Deps;
  /** The factory function to create the instance, default to `(...deps) => new Klazz(...deps)` */
  factory?: ServiceFactoryFn<T, Deps>;
  /** The lifetime of the instance, default to 'singleton' */
  lifetime?: ServiceLifetime;
};

type Constructor<T> = {
  new (...args: any[]): T;
};

/**
 * makeClassProvider annotate a class as a provider serving for the instance
 * type, and also an interface can be implemented.
 * @category Service Registry
 */
export const makeClassProvider =
  <_T, Deps extends readonly ServiceDependency<any>[]>({
    name,
    factory,
    deps = [] as never,
    lifetime = 'singleton',
  }: ClassProviderOptions<_T, Deps> = {}) =>
  <T extends _T, Klazz extends Constructor<T>>(
    klazz: Klazz & Constructor<T>
  ): ServiceProvider<_T extends {} ? _T : T, ResolveDependencies<Deps>> &
    Klazz => {
    validateLifetime(lifetime);
    const requirements = deps.map(polishServiceRequirement);

    return Object.defineProperties(klazz, {
      $$name: { value: name || klazz.name, configurable: true },
      $$typeof: { value: MACHINAT_SERVICE_PROVIDER, configurable: true },
      $$deps: { value: requirements, configurable: true },
      $$factory: {
        value: factory || ((...args) => new klazz(...args)), // eslint-disable-line new-cap
        configurable: true,
      },
      $$lifetime: { value: lifetime, configurable: true },
      $$multi: { value: false, configurable: true },
    });
  };

type FactoryProviderOptions<Deps extends readonly ServiceDependency<any>[]> = {
  /** The provider name for debugging purpose */
  name?: string;
  /** The interfaces of the required dependencies */
  deps?: Deps;
  /** The lifetime of the instance, default to 'transient' */
  lifetime?: ServiceLifetime;
};

/**
 * makeFactoryProvider annotate a factory function as a provider serving for the
 * instance type, and also an interface can be implemented.
 * @category Service Registry
 */
export const makeFactoryProvider =
  <_T, Deps extends readonly ServiceDependency<any>[]>({
    name,
    deps = [] as never,
    lifetime = 'transient',
  }: FactoryProviderOptions<Deps> = {}) =>
  <T extends _T>(
    factory: ServiceFactoryFn<T, Deps>
  ): ServiceProvider<_T extends {} ? _T : T, ResolveDependencies<Deps>> &
    ServiceFactoryFn<T, Deps> => {
    validateLifetime(lifetime);
    const requirements = deps.map(polishServiceRequirement);

    return Object.defineProperties(factory, {
      $$name: { value: name || factory.name, configurable: true },
      $$typeof: { value: MACHINAT_SERVICE_PROVIDER, configurable: true },
      $$deps: { value: requirements, configurable: true },
      $$factory: { value: factory, configurable: true },
      $$lifetime: { value: lifetime, configurable: true },
      $$multi: { value: false, configurable: true },
    });
  };

type MakeInterfaceOptions = {
  multi?: boolean;
  polymorphic?: boolean;
  name: string;
};

/**
 * makeInterface make a non class service interface
 * @category Service Registry
 */
export function makeInterface<T>(options: {
  name: string;
  polymorphic: true;
}): PolymorphicServiceInterface<T>;
export function makeInterface<T>(options: {
  name: string;
  multi: true;
}): MultiServiceInterface<T>;
export function makeInterface<T>(options: {
  name: string;
  multi?: false;
  polymorphic?: false;
}): SingularServiceInterface<T>;
export function makeInterface<T>({
  multi = false,
  polymorphic = false,
  name,
}: MakeInterfaceOptions): ServiceInterface<T> {
  invariant(
    !(multi && polymorphic),
    'cannot be mulit and polymorphic at the same time'
  );

  return {
    $$name: name,
    $$multi: multi as never,
    $$polymorphic: polymorphic,
    $$typeof: MACHINAT_SERVICE_INTERFACE,
  };
}
