# 点播源接入与连通性报告

默认接口由 17 个更新为 **25 个**：新增 10 个通过播放抽查的接口，移出本次两轮播放检查均未通过的暴风资源与艾旦影视。它们仍在搜索/详情备选列表中，可以在部署网络复测后自行导入。接口数量不等于独立片库数量；M3U8专用入口、备用域名可能共享同一个资源站。

检测时间：2026-10-14T12:50:53.821463+00:00。最新一轮检测 **238** 个候选，67 个返回 CMS JSON，51 个能搜到相关结果，49 个通过详情检查，**26 个通过播放检查**；第三轮有31个通过，其中25个在最近两轮持续通过，最终仅将这25个设为默认。爱奇艺首两轮通过、第三轮失败，移回备选。两轮记录：[第一轮](https://github.com/jokerGX/LibreTV/actions/runs/38566395902)、[第二轮](https://github.com/jokerGX/LibreTV/actions/runs/38566680256)。[第三轮检查](https://github.com/jokerGX/LibreTV/actions/runs/38567377644)。新增源均在最近两轮通过两部影片检查；第三轮新通过的6个接口未自动加入默认。

## 检测标准与范围

每个默认源必须通过相关关键词搜索、按 ID 获取详情，并有至少 **两部不同影片**通过 HLS 清单、子清单、加密密钥（若有）及媒体分片访问检查；每源最多抽查四部影片，分片只读取前1024字节。TLS证书校验与公网地址检查保持开启。

检测位置是 GitHub Actions Ubuntu（centralus），不代表所有影片、所有集数、浏览器解码及所有地区都可播放。已从公共状态接口确认 https://jokergxtv.netlify.app 使用本 fork 并下发原来的17个默认源；该站点启用了密码登录，本次没有使用登录凭证，因此没有从其受保护的搜索/代理接口发起播放检测。完整结果见 [source-health.json](../data/source-health.json)。

## Netlify 使用

Netlify 生产分支选择本仓库的 `main`，保留 `PASSWORD`。推送后等待自动部署，或到 Deploys → Trigger deploy 重新部署。部署成功后刷新网站即可自动出现新源。内置源使用稳定 URL 标识；新增接口会自动勾选，原有仍存在的源保持用户选择。

未配置或清空 `DEFAULT_SOURCES` 时使用内置列表；已有非空环境变量会完全覆盖内置列表，显式 `[]` 会关闭默认源。

默认订阅地址：`https://raw.githubusercontent.com/jokerGX/LibreTV/main/public/verified-sources.json`

搜索和详情备选地址（49 个，包含播放检查失败的源）：`https://raw.githubusercontent.com/jokerGX/LibreTV/main/public/api-sources.json`

两份列表包含重叠接口，选择一份即可。它们是实测快照，不会自行更新。设置 → 源管理 → 测试全部可以检查实际 Netlify 服务器的 API 搜索响应；此内置探活不检查播放分片。

Docker 必须从本 fork 源码构建（`docker compose up -d --build`）；上游镜像不包含本 fork 的默认源改动。

## 复测与来源

Actions → Source connectivity and validation → Run workflow 可以复测，工作流只读仓库，不自动替换默认源，结果在 `source-connectivity-report` 附件中。若无源通过，脚本返回失败并保留现有列表。

本地：`python3 scripts/check-sources.py`。

候选地址及每项来源见 [source-candidates.json](../data/source-candidates.json)。来源包括 [vodtv/api](https://github.com/vodtv/api)、[hafrey1/LunaTV-config](https://github.com/hafrey1/LunaTV-config)、[hy5528/tvbox](https://github.com/hy5528/tvbox)、[qist/tvbox](https://github.com/qist/tvbox)、[franksun1211/TVBOX](https://github.com/franksun1211/TVBOX)、[guxiangbin/tvbox2](https://github.com/guxiangbin/tvbox2)、[吉吉资源站](https://www.jjzy.tv/)等公开配置与原站接口说明。仅检测可直接访问的 JSON 接口，没有使用第三方中转代理、Spider引擎或付费解析服务。

## 默认源

| 名称 | 接口 |
| --- | --- |
| iKun资源 | https://ikunzyapi.com/api.php/provide/vod |
| 光速（M3U8入口） | https://api.guangsuapi.com/api.php/provide/vod/from/gsm3u8 |
| 光速资源 | https://api.guangsuapi.com/api.php/provide/vod |
| 金鹰资源（新接口） | https://jyzyapi.com/provide/vod |
| iKun（M3U8入口） | https://ikunzyapi.com/api.php/provide/vod/from/ikm3u8/at/json |
| 魔都动漫 | https://caiji.moduapi.cc/api.php/provide/vod |
| 红牛（备用） | https://hongniuzy2.com/api.php/provide/vod/from/hnm3u8 |
| 金鹰资源（备用接口） | https://jyzyapi.com/api.php/provide/vod |
| 红牛（备用域名） | https://www.hongniuzy3.com/api.php/provide/vod |
| 速播资源 | https://subocaiji.com/api.php/provide/vod |
| 金鹰资源（M3U8入口） | https://jyzyapi.com/provide/vod/from/jinyingm3u8 |
| 豪华资源 | https://hhzyapi.com/api.php/provide/vod |
| 虎牙（M3U8入口） | https://www.huyaapi.com/api.php/provide/vod/from/hym3u8 |
| 红牛资源 | https://www.hongniuzy2.com/api.php/provide/vod |
| 新浪资源 | https://api.xinlangapi.com/xinlangapi.php/provide/vod |
| 虎牙资源 | https://www.huyaapi.com/api.php/provide/vod |
| 360 资源 | https://360zyzz.com/api.php/provide/vod |
| 金鹰点播 | https://jinyingzy.com/api.php/provide/vod |
| 魔都资源 | https://www.mdzyapi.com/api.php/provide/vod |
| 360资源（备用域名） | https://360zy.tv/api.php/provide/vod |
| 360资源（原站） | https://360zy.com/api.php/provide/vod |
| 魔都（备用域名） | https://www.moduzy.com/api.php/provide/vod |
| 猫眼资源 | https://api.maoyanapi.top/api.php/provide/vod |
| 吉吉资源 | https://caiji.jjzyapi.com/api.php/provide/vod |
| 如意资源 | https://cj.rycjapi.com/api.php/provide/vod |

## 逐源检测

失败原因只对应本轮位置与样本；“播放”表示至少两部影片的抽样链路通过。

| 名称 | API | 搜索 | 详情 | 播放 | 失败原因 |
| --- | --- | --- | --- | --- | --- |
| 爱奇艺资源 | ✓ | ✓ | ✓ | ✓ |  |
| 豆瓣资源 | ✓ | — | — | — | no relevant search results: not an Apple CMS JSON list; not an Apple CMS JSON list; not an Apple CMS JSON list |
| 茅台资源 | ✓ | — | — | — | no relevant search results: not an Apple CMS JSON list; not an Apple CMS JSON list; not an Apple CMS JSON list |
| 卧龙资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| iKun资源 | ✓ | ✓ | ✓ | ✓ |  |
| 电影天堂 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 猫眼资源 | ✓ | ✓ | ✓ | ✓ |  |
| 量子资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found |
| 360 资源 | ✓ | ✓ | ✓ | ✓ |  |
| 极速资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: private/reserved address rejected; private/reserved address rejected; private/reserved address rejected; private/reserved address rejected |
| 魔都资源 | ✓ | ✓ | ✓ | ✓ |  |
| 非凡资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 暴风资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 404: Not Found; HTTP Error 404: Not Found; 'ascii' codec can't encode character '\u671f' in position 33: ordinal not in range(128) |
| 最大资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 无尽资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 新浪资源 | ✓ | ✓ | ✓ | ✓ |  |
| 旺旺资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 速播资源 | ✓ | ✓ | ✓ | ✓ |  |
| 金鹰点播 | ✓ | ✓ | ✓ | ✓ |  |
| 飘零资源 | — | — | — | — | HTTP Error 403: Forbidden |
| U酷影视 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 光速资源 | ✓ | ✓ | ✓ | ✓ |  |
| 红牛资源 | ✓ | ✓ | ✓ | ✓ |  |
| 魔都动漫 | ✓ | ✓ | ✓ | ✓ |  |
| 如意资源 | ✓ | ✓ | ✓ | ✓ |  |
| 豪华资源 | ✓ | ✓ | ✓ | ✓ |  |
| 百度云zy | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 艾旦影视 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 404: Not Found; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 山海资源 | — | — | — | — | [Errno -3] Temporary failure in name resolution |
| 金蝉影视 | — | — | — | — | [Errno -2] Name or service not known |
| 量子影视 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found; HTTP Error 404: Not Found |
| 最大点播 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 无尽影视 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 旺旺短剧 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 优质资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 虎牙资源 | ✓ | ✓ | ✓ | ✓ |  |
| 鸭鸭资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 索尼资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 快车资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 闪电资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 樱花资源 | ✓ | — | — | — | no relevant search results: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 360资源（原站） | ✓ | ✓ | ✓ | ✓ |  |
| 天涯资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 黑木耳 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 非凡（旧接口） | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 开放电影 | — | — | — | — | HTTP Error 404: Not Found |
| 优质（旧接口） | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 39影视 | — | — | — | — | HTTP Error 523: <none> |
| 天堂资源 | — | — | — | — | Remote end closed connection without response |
| 乐活影视 | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is not valid for 'lehootv.com'. (_ssl.c:1000)> |
| 唐人街 | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| 酷点资源 | — | — | — | — | [Errno -2] Name or service not known |
| 卧龙（采集站） | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 酷点（备用） | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is not valid for 'kudian10.com'. (_ssl.c:1000)> |
| 影库资源网 | — | — | — | — | [Errno -2] Name or service not known |
| 快车（旧接口） | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1000)> |
| 探探资源 | — | — | — | — | <urlopen error timed out> |
| 红牛（备用） | ✓ | ✓ | ✓ | ✓ |  |
| 非凡资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 无水印资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 非凡 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 横院 | ✓ | ✓ | — | — | fewer than two playable titles: no compatible HLS episode; no compatible HLS episode; no compatible HLS episode; no compatible HLS episode |
| 金鹰资源（新接口） | ✓ | ✓ | ✓ | ✓ |  |
| lurenjia | — | — | — | — | [Errno -2] Name or service not known |
| zzdj | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| csp_非凡资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 鸡婆 | — | — | — | — | [Errno -2] Name or service not known |
| 至圣云(官） | — | — | — | — | [Errno -2] Name or service not known |
| 享看 | — | — | — | — | [Errno -2] Name or service not known |
| 天空资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 天空 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 49zy | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| 快车资源 | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1000)> |
| 闪电资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 光速（M3U8入口） | ✓ | ✓ | ✓ | ✓ |  |
| 飞速 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 快云资源 | — | — | — | — | [Errno -2] Name or service not known |
| jszy | ✓ | ✓ | ✓ | — | fewer than two playable titles: private/reserved address rejected; private/reserved address rejected; private/reserved address rejected; private/reserved address rejected |
| 高清资源网 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 搜狐资源 | — | — | — | — | <urlopen error timed out> |
| xml_大漠 | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| xml_轻简 | — | — | — | — | [Errno -2] Name or service not known |
| xml_猫放 | — | — | — | — | not an Apple CMS JSON list |
| 八戒资源 | — | — | — | — | [Errno -2] Name or service not known |
| 映迷 | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired (_ssl.c:1000)> |
| 魔都（备用域名） | ✓ | ✓ | ✓ | ✓ |  |
| iKun（M3U8入口） | ✓ | ✓ | ✓ | ✓ |  |
| 虎牙（M3U8入口） | ✓ | ✓ | ✓ | ✓ |  |
| U酷资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 奇虎资源 | — | — | — | — | [Errno -2] Name or service not known |
| q享看 | — | — | — | — | [Errno -2] Name or service not known |
| 腾讯资源 | — | — | — | — | <urlopen error timed out> |
| csp_WDzy | — | — | — | — | [Errno -2] Name or service not known |
| 新片热播 | — | — | — | — | [Errno -2] Name or service not known |
| 芒果资源 | — | — | — | — | <urlopen error timed out> |
| 爱奇艺资源 | — | — | — | — | <urlopen error timed out> |
| 优酷资源 | — | — | — | — | <urlopen error timed out> |
| haiwaikan | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1000)> |
| 快帆 | — | — | — | — | [Errno -2] Name or service not known |
| __看看 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| __影录 | — | — | — | — | [Errno -2] Name or service not known |
| __m3u | — | — | — | — | [Errno -2] Name or service not known |
| __影视 | — | — | — | — | [Errno -2] Name or service not known |
| 8090资源 | — | — | — | — | [Errno -2] Name or service not known |
| 麒麟资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 诺讯资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 江北资源 | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate (_ssl.c:1000)> |
| 思古官采 | — | — | — | — | [Errno -2] Name or service not known |
| 星一官采 | — | — | — | — | [Errno -2] Name or service not known |
| 片库 | — | — | — | — | [Errno -2] Name or service not known |
| 看猫 | — | — | — | — | <urlopen error timed out> |
| 忆梦 | — | — | — | — | [Errno -2] Name or service not known |
| 土狗官采 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 晓成云 | — | — | — | — | HTTP Error 403: Forbidden |
| 首涂官采 | — | — | — | — | <urlopen error timed out> |
| 奥特曼资源 | — | — | — | — | [Errno -2] Name or service not known |
| 雪人官采 | — | — | — | — | [Errno -2] Name or service not known |
| 木子看剧 | — | — | — | — | [Errno -2] Name or service not known |
| TOM资源 | — | — | — | — | [Errno -2] Name or service not known |
| 松鼠资源 | — | — | — | — | [Errno -2] Name or service not known |
| OK资源 | — | — | — | — | [Errno -2] Name or service not known |
| 猫眼资源 | — | — | — | — | [Errno -2] Name or service not known |
| FOX资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 神速资源 | — | — | — | — | [Errno -2] Name or service not known |
| 番茄资源 | — | — | — | — | <urlopen error [SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)> |
| 北斗星资源 | — | — | — | — | [Errno -2] Name or service not known |
| 想看资源 | — | — | — | — | [Errno -2] Name or service not known |
| 酷点资源 | — | — | — | — | HTTP Error 403: Forbidden |
| 速更资源 | — | — | — | — | <urlopen error timed out> |
| 飞速资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 鱼乐资源 | — | — | — | — | [Errno -2] Name or service not known |
| 快播资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 无尽资源2 | — | — | — | — | [Errno -2] Name or service not known |
| 无尽资源 | — | — | — | — | HTTP Error 404: Not Found |
| 聚合资源 | — | — | — | — | [Errno -2] Name or service not known |
| 南国影源 | — | — | — | — | [Errno -2] Name or service not known |
| 淘剧鸭 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 293影视 | — | — | — | — | HTTP Error 403: Forbidden |
| 看看资源 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 开放云(X5) | — | — | — | — | [Errno -2] Name or service not known |
| 唐人资源 | — | — | — | — | [Errno -2] Name or service not known |
| 789盘 | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| 喵派对蓝光 | — | — | — | — | [Errno -2] Name or service not known |
| 酷扑(人人迷) | — | — | — | — | Remote end closed connection without response |
| 旋风云 | — | — | — | — | <urlopen error timed out> |
| 奈菲迷 | — | — | — | — | [Errno -2] Name or service not known |
| 鸭奈飞 | — | — | — | — | [Errno -2] Name or service not known |
| 鸭奈飞1 | — | — | — | — | <urlopen error timed out> |
| 皮荼熊TV | — | — | — | — | [Errno -2] Name or service not known |
| XYUI | — | — | — | — | [Errno -2] Name or service not known |
| 饭后电影 | — | — | — | — | [Errno -2] Name or service not known |
| 考拉TV | — | — | — | — | HTTP Error 403: Forbidden |
| 荔枝影视 | — | — | — | — | [Errno -2] Name or service not known |
| 段友影视 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 一点影视 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 旧梦影视 | — | — | — | — | [Errno -2] Name or service not known |
| 51看剧 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 思古影视 | — | — | — | — | [Errno -2] Name or service not known |
| 天天看 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 每天看看 | — | — | — | — | HTTP Error 404: Not Found |
| 一拳动漫 | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| BL视频 | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate (_ssl.c:1000)> |
| 畅视影视 | — | — | — | — | [Errno -2] Name or service not known |
| OmoFun动漫 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 人人资源 | — | — | — | — | [Errno -2] Name or service not known |
| 人人影视 | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| 小蜻蜓APP | — | — | — | — | [Errno -2] Name or service not known |
| 星一蓝光 | — | — | — | — | HTTP Error 400: Bad Request |
| 筋斗云 | — | — | — | — | <urlopen error [SSL: TLSV1_UNRECOGNIZED_NAME] tlsv1 unrecognized name (_ssl.c:1000)> |
| 影图 | — | — | — | — | HTTP Error 403: Forbidden |
| 猪猪影视 | — | — | — | — | [Errno -2] Name or service not known |
| 初恋云影视 | — | — | — | — | [Errno -2] Name or service not known |
| 绿地影视 | — | — | — | — | [Errno -2] Name or service not known |
| 天天影视 | — | — | — | — | [Errno -2] Name or service not known |
| 小猫咪 | — | — | — | — | HTTP Error 404: Not Found |
| 酷点影视 | — | — | — | — | [Errno -2] Name or service not known |
| 小城影视 | — | — | — | — | <urlopen error timed out> |
| 橘子影视 | — | — | — | — | [Errno -2] Name or service not known |
| 小慧影视 | — | — | — | — | [Errno -2] Name or service not known |
| 超高清影视 | — | — | — | — | [Errno -2] Name or service not known |
| 艾思影视 | — | — | — | — | [Errno -2] Name or service not known |
| VV影视 | — | — | — | — | [Errno -2] Name or service not known |
| 迅播影视 | — | — | — | — | [Errno -2] Name or service not known |
| 39影视 | — | — | — | — | HTTP Error 523: <none> |
| 剧大神 | — | — | — | — | [Errno -2] Name or service not known |
| 8K影视 | — | — | — | — | HTTP Error 403: Forbidden |
| 嗨哆咪影视 | — | — | — | — | [Errno -2] Name or service not known |
| 橘猫影视 | — | — | — | — | <urlopen error timed out> |
| 飞鱼影视 | — | — | — | — | [Errno -2] Name or service not known |
| 飘花电影 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 晓峰影视 | — | — | — | — | [Errno -2] Name or service not known |
| 千寻时光 | — | — | — | — | [Errno -3] Temporary failure in name resolution |
| 快看客栈 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 网民电影 | — | — | — | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 兔子窝 | — | — | — | — | [Errno -2] Name or service not known |
| 哇可可影视 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 共青春 | — | — | — | — | HTTP Error 404: Not Found |
| 酷猫影视 | — | — | — | — | [Errno -2] Name or service not known |
| 胖猫影视 | — | — | — | — | HTTP Error 503: Service Temporarily Unavailable |
| 海外电影 | — | — | — | — | [Errno -2] Name or service not known |
| 金鹰点播 | ✓ | ✓ | — | — | fewer than two playable titles: no compatible HLS episode; no compatible HLS episode; no compatible HLS episode; no compatible HLS episode |
| TV-wujinapi无尽 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| TV-卧龙资源 | — | — | — | — | [Errno -5] No address associated with hostname |
| TV-小猫咪资源 | — | — | — | — | [Errno -2] Name or service not known |
| TV-无尽资源 | ✓ | ✓ | ✓ | — | fewer than two playable titles: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| TV-牛牛点播 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| TV-豆瓣资源 | — | — | — | — | [Errno -5] No address associated with hostname |
| TV-豆瓣资源 | ✓ | — | — | — | no relevant search results: not an Apple CMS JSON list; not an Apple CMS JSON list; not an Apple CMS JSON list |
| 金鹰资源（备用接口） | ✓ | ✓ | ✓ | ✓ |  |
| TV-魔爪资源 | — | — | — | — | <urlopen error [Errno 111] Connection refused> |
| TV-黑木耳点播 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 华为吧资源 | — | — | — | — | <urlopen error timed out> |
| 红牛（备用域名） | ✓ | ✓ | ✓ | ✓ |  |
| 蜂巢片库 | — | — | — | — | [Errno -2] Name or service not known |
| 金马资源网 | — | — | — | — | <urlopen error [SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)> |
| 优质资源库1080zyk6.com高清 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| iqiyi资源 | — | — | — | — | HTTP Error 503: Service Temporarily Unavailable |
| 七七影视 | — | — | — | — | <urlopen error [SSL: WRONG_VERSION_NUMBER] wrong version number (_ssl.c:1000)> |
| 饭团影视 | — | — | — | — | [Errno -2] Name or service not known |
| TV-豆瓣资源3 | ✓ | — | — | — | no relevant search results: not an Apple CMS JSON list; not an Apple CMS JSON list; not an Apple CMS JSON list |
| TV-海洋资源 | — | — | — | — | The read operation timed out |
| 💎无限资源🍏2 | — | — | — | — | [Errno -2] Name or service not known |
| 💎虾米资源🍏2 | — | — | — | — | [Errno -2] Name or service not known |
| 💎天翼影视🍏2 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 💎忆梦影视🍏2 | — | — | — | — | Expecting value: line 1 column 1 (char 0) |
| 💎乐视LS🍎1 | — | — | — | — | [Errno -5] No address associated with hostname |
| 360资源（备用域名） | ✓ | ✓ | ✓ | ✓ |  |
| 💎OK资源🍎1 | — | — | — | — | [Errno -2] Name or service not known |
| 💎1080P资源🍎1 | — | — | — | — | [Errno -5] No address associated with hostname |
| 💎快看KK🍎1 | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1000)> |
| 💎樱花YH🍎1 | ✓ | — | — | — | no relevant search results: HTTP Error 403: Forbidden; HTTP Error 403: Forbidden |
| 💎鱼乐LY🍎2 | — | — | — | — | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> |
| 第一资源 | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 吉吉资源 | ✓ | ✓ | ✓ | ✓ |  |
| 天涯（新接口） | ✓ | — | — | — | no relevant search results: Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0); Expecting value: line 1 column 1 (char 0) |
| 淘片资源 | — | — | — | — | <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired (_ssl.c:1000)> |
| 金鹰资源（M3U8入口） | ✓ | ✓ | ✓ | ✓ |  |
| 暴风App | — | — | — | — | HTTP Error 404: Not Found |
