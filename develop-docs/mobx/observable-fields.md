# MobX 6：可观察字段的声明与初始化

判断构造函数里的 `Object.assign(this, { field: undefined })` 能否删除，关键不是 `undefined` 有没有业务意义，而是：**调用 `makeObservable` 时，编译后的实例上是否已经存在这个字段？** 读取一个不存在的属性也会得到 `undefined`，所以不能用 `this.field === undefined` 判断属性是否存在。

## 先区分两种注册方式

| 项目中的写法 | 构造函数中的注册 | 是否需要先赋值 |
| --- | --- | --- |
| `@observable ext: string`（legacy 装饰器） | `makeObservable(this)` 读取装饰器注解 | 对 `AttachmentFile.ext` 的最小验证表明，当前 TypeScript 和 Babel 两条路径不做占位赋值也能注册。不等于可以删掉 `makeObservable(this)`。 |
| `responsiveItems: any[]`（无装饰器、无初值） | `makeObservable(this, { responsiveItems: observable })` 显式注册 | 需要确保注册前字段已存在。当前 TypeScript 配置会保留类字段，项目的 Babel 配置则会移除这种纯类型声明，导致 MobX 报 `Field not found`。 |

项目使用 MobX 6 和 legacy 装饰器：[TypeScript 配置](../../tsconfig.json) 启用了 `experimentalDecorators`，[Babel 配置](../../tools/getBabelCommonConfig.js) 使用 `version: 'legacy'`。`@observable` 和 `@observable.ref` 都是有效写法，不需要改成现代装饰器的 `@observable accessor`。以上编译行为针对当前配置；升级编译器或修改类字段、装饰器配置后应重新验证。

## 对照仓库里的三个例子

- [AttachmentFile](../../components-dataset/data-set/AttachmentFile.tsx)：`ext` 有 `@observable` 装饰器。构造函数中的 `Object.assign` 只是给它一个 `undefined` 初值；真正的扩展名由 `load` 从文件名解析。不要把该字段的验证结论套用到无装饰器的字段。
- [DataSet](../../components-dataset/data-set/DataSet.tsx)：构造函数先用一次 `Object.assign` 为 `records`、`fields` 等字段占位，再用显式注解表注册。占位不代表这些字段的业务默认值；不要因为构造函数后面还会赋值，就整段删除。
- [Form](../../components-pro/form/Form.tsx)：`hasOwnProperty.call(this, 'responsiveItems')` 检查实例自身是否有该属性，只在缺失时补上，不会覆盖已有值。后面的 `this.responsiveItems = []` 在注册之后执行，不能补救注册时的字段缺失。

## 新增或调整字段时怎么写

有明确业务默认值时，直接在字段声明处初始化，不必再在构造函数里占位。如果初始状态确实是「尚未设置」，让类型和值都体现这一点：

```ts
import { makeObservable, observable } from 'mobx';

class UploadState {
  files: string[] = [];
  errorMessage: string | undefined = undefined;

  constructor() {
    makeObservable(this, {
      files: observable,
      errorMessage: observable,
    });
  }
}
```

排查 `Field not found` 时，在 `makeObservable` **之前**用 `Object.prototype.hasOwnProperty.call(this, '字段名')` 检查普通实例字段是否存在，再在注册**之后**用 MobX 的 `isObservableProp(instance, '字段名')` 确认可观察性。清理已有占位代码时，应使用项目实际的 Babel 构建路径验证，不能只看 TypeScript 类型检查是否通过。
