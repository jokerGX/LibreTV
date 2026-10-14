# 点播源接入与连通性报告

本 fork 已预置 17 个经过 API、相关搜索、详情、HLS 清单及媒体分片检查的接口。未配置 `DEFAULT_SOURCES` 时自动加载，客户端通过 `/api/status` 获取并勾选新源，无需手填 API。

检测时间：2026-10-14T12:21:39.398237+00:00。检测位置：GitHub Actions Ubuntu（centralus），不是你的部署服务器。每个接口最多抽查 4 部影片，媒体分片仅请求前 1024 字节；这证明抽样链路可访问，不代表所有影片、集数、浏览器解码或所有地区都可播放。

## 结果

共检测 58 个公开点播接口，38 个返回符合要求的 CMS JSON，30 个通过相关搜索和详情，17 个进一步通过播放清单与媒体分片检查。仅后者自动预置。

两轮检测有波动：爱奇艺资源首轮通过、第二轮返回 503；暴风资源搜索样本播放 404，但第二轮近期影片样本通过。最新记录见 [source-health.json](../data/source-health.json)。

## 使用

源码部署或 Vercel 从本 fork 重新部署后，登录并刷新网页即可在「设置 → 源管理 → 点播源」看到默认源。可以取消勾选，已有健康度机制会自动停用连续失败的源。

已有 `DEFAULT_SOURCES` 会完全覆盖内置列表（包括显式 `[]`）；要启用内置列表，删除或清空该变量后重新部署。自定义源与既有勾选状态继续保留。内置源使用 URL 稳定标识，排序变化不会改变标识。

Docker 需从本 fork 源码构建：`docker compose up -d --build`。继续拉取上游 `ghcr.io/librespark/libretv` 镜像不会包含本 fork 的改动。

也可以把下列链接填到兼容 LibreTV 的「数据源订阅」中：

- 默认实测列表：`https://raw.githubusercontent.com/jokerGX/LibreTV/main/public/verified-sources.json`
- 更全的搜索/详情列表（30 个，包含播放被 403/404 拒绝的源，需实际部署网络复测）：`https://raw.githubusercontent.com/jokerGX/LibreTV/main/public/api-sources.json`

两份列表有重叠，选择一份即可。列表是有日期的实测快照，不会自行更新。

## 复测

Actions → Source connectivity and validation → Run workflow 可重新检测。工作流只读仓库，不自动提交或替换默认配置，结果在 `source-connectivity-report` 附件中。确认结果后，可将附件的 `verified-sources.json` 更新到 `public/`，将 `source-health.json` 更新到 `data/`。若没有任何源通过，脚本返回失败，保留已有配置。

本地命令：`python3 scripts/check-sources.py`。

项目「源管理 → 测试全部」可核对实际部署服务器的 API 连通性；此内置探活仅测试搜索响应，不能代替播放分片检查。

## 来源

候选地址及逐项来源保留在 [source-candidates.json](../data/source-candidates.json)，未使用第三方中转代理：

- [vodtv/api 接口配置](https://github.com/vodtv/api/blob/main/LunaTV-config.json)
- [LibreTV 社区接口讨论](https://github.com/LibreSpark/LibreTV/discussions/652)
- [LibreTV 数据源格式](https://github.com/LibreSpark/LibreTV/wiki/Data-Sources)

## 逐源检测

“播放”表示抽样 HLS 清单与分片访问通过。失败原因对应本次位置与样本。

| 名称 | API | 搜索 | 详情 | 播放 | 搜索耗时 ms | 失败原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 爱奇艺 | — | — | — | — | — | HTTP Error 503: Service Temporarily Unavailable |
| 豆瓣资源 | ✓ | — | — | — | — | no relevant search results: not an Apple CMS JSON list; not an Apple CMS JSON list; not an Apple CMS JSON list |
| 茅台资源 | ✓ | — | — | — | — | no relevant search results: not an Apple CMS JSON list; not an Apple CMS JSON list; not an Apple CMS JSON list |
| 卧龙资源 | — | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| iKun资源 | ✓ | ✓ | ✓ | ✓ | 108 |  |
| 电影天堂 | ✓ | ✓ | ✓ | — | 227 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 猫眼资源 | ✓ | ✓ | ✓ | ✓ | 1053 |  |
| 量子资源 | ✓ | ✓ | ✓ | — | 374 | HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found |
| 360 资源 | ✓ | ✓ | ✓ | ✓ | 405 |  |
| 极速资源 | ✓ | ✓ | ✓ | — | 318 | private/reserved address rejected; private/reserved address rejected; private/reserved address rejected; private/reserved address rejected |
| 魔都资源 | ✓ | ✓ | ✓ | ✓ | 228 |  |
| 非凡资源 | ✓ | ✓ | ✓ | — | 1084 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 暴风资源 | ✓ | ✓ | ✓ | ✓ | 119 |  |
| 最大资源 | ✓ | ✓ | ✓ | — | 256 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 无尽资源 | ✓ | ✓ | ✓ | — | 56 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 新浪资源 | ✓ | ✓ | ✓ | ✓ | 521 |  |
| 旺旺资源 | — | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 速播资源 | ✓ | ✓ | ✓ | ✓ | 317 |  |
| 金鹰点播 | ✓ | ✓ | ✓ | ✓ | 379 |  |
| 飘零资源 | — | — | — | — | — | HTTP Error 403: Forbidden |
| U酷影视 | ✓ | ✓ | ✓ | — | 81 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 光速资源 | ✓ | ✓ | ✓ | ✓ | 138 |  |
| 红牛资源 | ✓ | ✓ | ✓ | ✓ | 340 |  |
| 魔都动漫 | ✓ | ✓ | ✓ | ✓ | 540 |  |
| 如意资源 | ✓ | ✓ | ✓ | ✓ | 1800 |  |
| 豪华资源 | ✓ | ✓ | ✓ | ✓ | 285 |  |
| 百度云zy | ✓ | ✓ | ✓ | — | 244 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 艾旦影视 | ✓ | ✓ | ✓ | ✓ | 1039 |  |
| 山海资源 | — | — | — | — | — | [Errno -3] Temporary failure in name resolution |
| 金蝉影视 | — | — | — | — | — | [Errno -2] Name or service not known |
| 量子影视 | ✓ | ✓ | ✓ | — | 131 | HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found |
| 最大点播 | ✓ | ✓ | ✓ | — | 281 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 无尽影视 | ✓ | ✓ | ✓ | — | 181 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 旺旺短剧 | — | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 优质资源 | ✓ | ✓ | ✓ | — | 999 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 虎牙资源 | ✓ | ✓ | ✓ | ✓ | 360 |  |
| 鸭鸭资源 | ✓ | — | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 索尼资源 | ✓ | — | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 快车资源 | ✓ | — | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 闪电资源 | ✓ | — | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 樱花资源 | ✓ | — | — | — | — | no relevant search results: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 360资源（原站） | ✓ | ✓ | ✓ | ✓ | 1829 |  |
| 天涯资源 | ✓ | — | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 黑木耳 | — | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 非凡（旧接口） | ✓ | ✓ | ✓ | — | 796 | HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 开放电影 | — | — | — | — | — | HTTP Error 404: Not Found |
| 优质（旧接口） | — | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 39影视 | — | — | — | — | — | HTTP Error 523: <none> |
| 天堂资源 | — | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 乐活影视 | — | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is not valid for 'lehootv.com'. (_ssl.c:1000)> |
| 唐人街 | — | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| 酷点资源 | — | — | — | — | — | [Errno -2] Name or service not known |
| 卧龙（采集站） | — | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 酷点（备用） | — | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is not valid for 'kudian10.com'. (_ssl.c:1000)> |
| 影库资源网 | — | — | — | — | — | [Errno -2] Name or service not known |
| 快车（旧接口） | — | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1000)> |
| 探探资源 | — | — | — | — | — | <urlopen error timed out> |
| 红牛（备用） | ✓ | ✓ | ✓ | ✓ | 375 |  |
