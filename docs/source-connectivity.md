# 点播源接入与连通性报告

本 fork 现默认启用 **68 个搜索和详情检查通过的接口**，其中 **43 个播放已验证、25 个播放待验证**。带过滤标记的源在内容范围为「不含 18+」时不会自动勾选。接口按地址去重，搜索并行且逐源显示结果，不等待较慢的接口。

未配置 `DEFAULT_LIVE_SOURCES` 时另下发两份国内直播列表（央视、卫视）和一份成人直播列表，地址见 `public/live-sources.json`。成人列表是站内 `public/adult-live.m3u`，带 18+ 标记，内容范围为「不含 18+」时不会自动启用。抽查时播放清单能返回分片，截帧是正常节目。打不开、整屏推广卡片，或画面带「去网站观看」推广条和二维码的列表没有加入。名称指向未成年的条目没有加入。除 Jenny Live（H.264）外，该列表其余频道为 H.265，当前浏览器不能解码时播放器会提示改用 Edge 或 Safari。

设置 → 源管理 → 点播源和搜索结果展开后的来源按钮均显示播放状态。展开后已验证来源排前，同等级保持结果返回顺序；只有待验证来源返回时也立即显示。新增来源返回不会收起已展开的影片。标签表示历史抽查结果，不承诺所有影片均能播放。

部分入口是同一资源站的备用域名或M3U8入口，接口数量不等于独立片库数量。下面表格是早前的播放验证快照，其后新增的接口见两份 JSON。以前移出的暴风、艾旦和爱奇艺现在作为待验证源参与搜索。

## 实测结果

检测时间：2026-10-14T12:55:48.678487+00:00。共检测 **238个候选接口**，最新一轮有67个返回CMS JSON、51个通过相关搜索、31个通过两部影片的播放抽查。播放已验证状态只授予最近两轮持续通过的 **25个**。爱奇艺接口第三轮失败，第三轮才通过的6个接口未加入默认。

- [第一轮](https://github.com/jokerGX/LibreTV/actions/runs/38566395902)
- [第二轮](https://github.com/jokerGX/LibreTV/actions/runs/38566680256)
- [第三轮](https://github.com/jokerGX/LibreTV/actions/runs/38567377644)
- [完整最新结果、失败原因和默认选择记录](../data/source-health.json)

## 验证标准与范围

每个默认接口至少两部不同影片通过：相关关键词搜索 → 按ID取详情 → HLS清单与子清单 → 加密密钥（若有）→ 媒体分片。每源最多抽查四部影片，分片读取前1024字节，TLS证书与公网地址校验保持开启。

上述播放检测在 GitHub Actions Ubuntu（centralus）运行，不保证所有影片、集数、浏览器解码及所有地区均可播放。

已通过用户提供站点的公开状态接口确认它使用本 fork，并下发之前的17个默认源。站点有密码保护，本次没有使用登录凭证，因此没有从Netlify受保护的搜索/播放代理接口发起检测。可选：在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 配置 `NETLIFY_SITE_URL` 为站点根地址，Netlify source deployment check工作流即可核对线上默认源是否与提交一致。未配置时部署状态检测跳过，不影响应用部署或接口检测。站点地址不写入仓库；部署检测不代替播放检测。

## Netlify 使用

生产分支选择本仓库 `main`，保留 `PASSWORD`。推送后等待自动部署，或到 Deploys → Trigger deploy 重新部署。部署成功后刷新网站，新增接口自动出现并勾选。

未配置或清空 `DEFAULT_SOURCES` 时使用内置列表；非空变量完全覆盖内置列表，显式 `[]` 关闭默认源。源使用稳定URL标识，排序变化不会改变其标识。

- 播放已验证订阅（43个）：`https://raw.githubusercontent.com/jokerGX/LibreTV/main/public/verified-sources.json`
- 全部搜索接口订阅（68个，包含25个播放待验证源，内置默认已覆盖）：`https://raw.githubusercontent.com/jokerGX/LibreTV/main/public/api-sources.json`

两份列表有重叠，选择一份即可，均为有日期的实测快照。设置 → 源管理 → 测试全部可以核对Netlify服务器的API搜索响应，但不检查播放分片。

Docker需从本fork源码构建：`docker compose up -d --build`。

## 播放已验证接口

| 名称 | 地址 |
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

其后补入的接口与这一节使用同一套连通性标准（搜索、详情，播放已验证的再抽查两部影片的分片），地址都在上面两份 JSON 里，这里不再单列。

## 复测与来源

Actions → Source connectivity and validation → Run workflow可重新检测，结果在 `source-connectivity-report` 附件；工作流不自动替换默认列表。若无源通过，脚本返回失败并保留现有列表。

本地运行：`python3 scripts/check-sources.py`。

所有候选及逐项来源见 [source-candidates.json](../data/source-candidates.json)。来源包括 [vodtv/api](https://github.com/vodtv/api)、[hafrey1/LunaTV-config](https://github.com/hafrey1/LunaTV-config)、[hy5528/tvbox](https://github.com/hy5528/tvbox)、[qist/tvbox](https://github.com/qist/tvbox)、[franksun1211/TVBOX](https://github.com/franksun1211/TVBOX)、[guxiangbin/tvbox2](https://github.com/guxiangbin/tvbox2)、[吉吉资源站](https://www.jjzy.tv/)等公开配置与原站说明。没有使用第三方中转代理、Spider引擎或付费解析服务。
