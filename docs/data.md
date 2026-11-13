# 数据来源

提交时要说明用了哪些 NASA 数据、为什么用。每接一个数据源就在这里登记：地址、用在游戏的哪里、游戏里怎么标注。

## NASA DONKI（太空天气数据库）

2026-11-13 实测。

- 可用地址：`https://ccmc.gsfc.nasa.gov/DONKI-API/get/{FLR|SEP|GST}?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
  - `FLR` 太阳耀斑，`SEP` 高能粒子事件，`GST` 地磁暴。
  - 不需要 key，允许浏览器跨域请求。
- `api.nasa.gov/DONKI/...` 目前返回 404，不要用。
- 时间跨度 70 多天的请求返回 400；10 天正常。
- 数据从 2010 年起。2003 年的“万圣节风暴”不在里面。
- 已确认有数据的时间段：
  - 2017 年 9 月：X9.3 级耀斑，有高能粒子事件。
  - 2024 年 5 月：有高能粒子事件，地磁暴达到 Kp 9。
  - 2026 年 11 月 3–13 日：8 次 M 级耀斑（说明近期数据能取到）。
- 用在哪：还没接进游戏。

## I-LOFAR（爱尔兰的射电望远镜）

- 在 Offaly 郡 Birr 城堡，2017 年建成，观测到过 2017 年 9 月大耀斑的射电爆发。
- 它是科研望远镜，不是预警机构。游戏里只能写“灵感来自”，不能说预警由它发布。
- 出处：https://www.tcd.ie/news_events/articles/new-radio-telescope-in-birr-detects-huge-solar-storms/

## 题目页列出的其他资源（还没用）

OSDR（太空生物和宇航员健康研究）、RadLab（国际空间站实测辐射剂量）、Mars Trek、加拿大航天局的青少年资源和“月球食物生产”教学包。链接见题目页。
