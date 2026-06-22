# 咨询项目报时

一个移动优先的 Next.js 小应用，用来按人员记录项目工时，并在月底查看人员和项目汇总。

## 功能

- 新增每日工作记录：日期、人员、项目、工时、工作备注
- 人员固定选项：Leila、yaozong
- 项目固定选项：PE internal、Burn、Roam、Epsilon、CleanMotion
- 月度汇总：总工时、记录数、按人员统计、按项目统计
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

## 数据结构

每条记录会以 JSON 字符串写入 Upstash Redis list：

```ts
{
  id: string;
  date: string;
  person: string;
  project: string;
  hours: number;
  notes: string;
  createdAt: string;
}
```
