# 咨询项目报时

一个移动优先的 Next.js 小应用，用来按人员记录项目工时，并在月底查看人员和项目汇总。

## 功能

- 新增每日工作记录：日期、人员、项目、工时、工作备注
- 人员固定选项：Leila、yaozong
- 项目固定选项：PE internal、Burn、Roam、Epsilon、CleanMotion
- 月度汇总：总工时、记录数、按人员统计、按项目统计
- 用户登录后才能报时、查看汇总和修改自己的账号设置
- 首个账号自动成为管理员，之后只有管理员可以创建新用户
- 当前账号可在“设置”选项卡修改用户名和密码，修改时需要输入当前密码
- 数据通过 Upstash Redis REST API 持久化

## 管理员账号

第一次打开系统时，如果 Upstash 里还没有用户，登录页会显示“创建管理员”。这个首个账号会自动获得管理员权限。

管理员登录后会看到“用户”选项卡，可以在那里创建普通用户。系统初始化完成后，公开页面不再提供自助注册入口。

如果你已经提前注册过账号，Upstash 里已经有用户，就不会再出现首次创建管理员界面。这时可以在 `.env.local` 里加入 `ADMIN_USERNAMES=你的用户名`，多个管理员用英文逗号分隔，例如 `ADMIN_USERNAMES=leila,yaozong`。

## Upstash 配置

在项目根目录创建 `.env.local`：

```bash
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

如果希望换 Redis key，可以额外设置：

```bash
UPSTASH_REDIS_KEY=consulting:work-entries
UPSTASH_USERS_KEY=consulting:users
UPSTASH_SESSION_PREFIX=consulting:sessions
ADMIN_USERNAMES=admin
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


