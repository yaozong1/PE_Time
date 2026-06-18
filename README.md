# 咨询项目工时记录

一个移动优先的 Next.js 小应用，用来按人员记录咨询项目在不同市场上的工作投入，并在月底查看分类汇总。

## 功能

- 新增每日工作记录：日期、人员、项目、市场、分类、工时、备注
- 月度汇总：总工时、记录数、按人员/项目/市场/分类统计
- 支持人员筛选，适合月底查看个人投入结构
- 数据通过 Upstash Redis REST API 持久化

## Upstash 配置

在项目根目录创建 `.env.local`：

```bash
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

如果希望换 Redis key，可以额外设置：

```bash
UPSTASH_REDIS_KEY=consulting:work-entries
```

## 本地运行

```bash
npm install
npm run dev
```

然后访问 `http://localhost:3000`。

如果本机 npm 在安装时中断，建议先删除未完成的 `node_modules` 后重新执行安装。

## 数据结构

每条记录会以 JSON 字符串写入 Upstash Redis list：

```ts
{
  id: string;
  date: string;
  person: string;
  project: string;
  market: string;
  category: "客户沟通" | "市场调研" | "方案撰写" | "数据分析" | "项目管理" | "其他";
  hours: number;
  notes: string;
  createdAt: string;
}
```
