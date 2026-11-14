# 数据来源

提交时要说明用了哪些 NASA 数据、为什么用。每接一个数据源就在这里登记：地址、用在游戏的哪里、游戏里怎么标注。

## NASA DONKI（太空天气数据库）——已接入

官方页面：https://ccmc.gsfc.nasa.gov/tools/DONKI/

### 接口（2026-11-13 实测）

- 可用地址：`https://ccmc.gsfc.nasa.gov/DONKI-API/get/{FLR|SEP|GST}?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - `FLR` 太阳耀斑，`SEP` 太阳高能粒子事件，`GST` 地磁暴。
  - 不需要 key，允许浏览器跨域请求。
  - 范围里没有记录时返回空内容，不是 `[]`。
- `api.nasa.gov/DONKI/...` 目前返回 404，不要用。
- 时间跨度 70 多天的请求返回 400；10 天正常。
- 数据从 2010 年起。2003 年的“万圣节风暴”不在里面。

### 怎么进的游戏

- `npm run data` 运行 `scripts/fetch-donki.mjs`，从接口取数并写出 `src/data/scenarios.json`。任何人都可以重跑来核对。
- 游戏不在运行时联网，用的是这份存档。游戏里明确写了“saved records, not live data”和取数日期。
- 内置三段，每段连续 10 天，另取前一天用于第 1 天的预报：
  - `quiet-2019`：2019 年 12 月 1–10 日。数据库里这十天没有任何耀斑记录（太阳活动极小期）。
  - `sep-2017`：2017 年 9 月 3–12 日。9 月 6 日 X9.3 级耀斑；9 月 4、5、6、10 日有近地航天器测到的高能粒子事件，其中 10 日测到 100 MeV 以上的质子。
  - `may-2024`：2024 年 5 月 6–15 日。5 月 10、11、13 日有粒子事件，11 日测到 100 MeV 以上；10–11 日地磁暴 Kp 达到 9。

### 真实数据和游戏规则的对应

写在 `src/game/scenario.ts` 的注释里，游戏的 “What is real in this game?” 面板也向玩家说明。

| 游戏里的东西 | 来自真实数据的部分 | 游戏的简化 |
|---|---|---|
| 当天有没有风暴 | DONKI 给每次太阳高能粒子事件记了近地航天器（GOES、SOHO、ACE）最早测到它的时间。模型预测的条目和远离地球的 STEREO A 不算 | 每次事件只算一个风暴日，就是它开始的那天。真实的粒子事件可以持续好几天，所以游戏里的“平静日”只表示当天没有新事件开始，不表示当天没有辐射 |
| 风暴是否“严重” | 是否测到 100 MeV 以上的质子 | 只分两级 |
| 早上的预报 | 前一天最强耀斑的级别 | X 级报“高”，M 级报“中”，其余报“低”。真实预报用的信息多得多 |
| 通讯中断 | 无 | 风暴日的第二天早上收不到预报，纯游戏规则 |
| 极光提示 | 当天 Kp 指数达到 7 以上 | 只是一句说明文字，不影响玩法 |
| 电、氧气、食物、健康的数值 | 无 | 全部是游戏设定 |

### 这个对应关系的已知缺陷

2017 年 9 月 10 日开始的那次粒子事件实际持续到 9 月 14 日，峰值在 11 日；但游戏里 9 月 11 日和 12 日是“平静日”。游戏里的措辞已经改成“当天没有新的粒子风暴开始”，没有再说“当天没有测到粒子”。

要做得更真实，需要带持续时间或逐日通量的数据（比如 GOES 的质子通量）。这是个值得问 NASA 数据导师的问题。事件资料：https://ccmc.gsfc.nasa.gov/challenges/sep/events/

### 游戏里怎么标注

- 每天的预报下面写着真实日期和 “from NASA DONKI”。
- 风暴结算时写明是哪几个航天器测到的，并链接到 NASA 的那条记录。
- 任务报告的逐日表格列出真实日期。

## NASA 关于猎户座飞船风暴避难方案的文章——已使用

- 地址：https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/
- 用在哪：任务报告里 “What real astronauts do” 一段，带链接。
- 用的内容：太阳风暴时宇航员在舱内中部搭避难处，把装着物资、食物和水的袋子围在身边挡辐射。

## I-LOFAR（爱尔兰的射电望远镜）——已提及

- 在 Offaly 郡 Birr 城堡，2017 年 7 月 27 日正式启用。它观测到的是 2017 年 9 月 10 日那次大耀斑的射电爆发，不是 9 月 6 日的 X9.3。
- 它是科研望远镜，不是预警机构。游戏里写的是地面指挥中心“inspired by” I-LOFAR，没有说预警由它发布。
- 出处：https://www.tcd.ie/news_events/articles/new-radio-telescope-in-birr-detects-huge-solar-storms/

## 任务简介里的事实性说法——已核实（2026-11-14）

这几句写在 `src/data/scenarios.ts`，出处链接也在那里，任务报告的 “What really happened” 一段会显示。

| 说法 | 出处原文怎么说 | 链接 |
|---|---|---|
| 太阳活动大约 11 年一个周期；2019 年 12 月是极小期 | NASA：“solar minimum occurred in December 2019”；“the approximately 11-year-cycle” | https://www.nasa.gov/news-release/solar-cycle-25-is-here-nasa-noaa-scientists-explain-what-that-means/ |
| 2017 年 9 月 6 日的 X9.3 是那个太阳周期里最大的耀斑 | NASA：“The X9.3 flare was the largest flare so far in the current solar cycle”；那个周期从 2008 年 12 月开始 | https://www.nasa.gov/solar-system/sun-erupts-with-significant-flare/ |
| Birr 的望远镜收到了另一次大耀斑的射电爆发 | TCD：9 月 10 日耀斑的射电爆发 “was observed by I-LOFAR at Birr Castle” | https://www.tcd.ie/news_events/articles/new-radio-telescope-in-birr-detects-huge-solar-storms/ |
| 2024 年 5 月是二十年来到达地球的最强太阳风暴 | NASA：“the strongest solar storm to reach Earth in two decades” | https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/ |
| 爱尔兰各地看到了极光 | RTÉ：极光 “visible across the country”，配图来自 Galway 和 Kerry | https://www.rte.ie/news/ireland/2024/0511/1448552-northern-lights |

核实时改掉了一处错：原来写的是“十多年来最强的耀斑，Birr 的望远镜收到了这次爆发”。NASA 的说法是“本太阳周期最大”（周期当时不到十年），而且 I-LOFAR 收到的是四天后另一次耀斑的射电爆发。简介已按出处改写。

## 题目页列出的其他资源（还没用）

OSDR（太空生物和宇航员健康研究）、RadLab（国际空间站实测辐射剂量）、Mars Trek、加拿大航天局的青少年资源和“月球食物生产”教学包。链接见题目页。
