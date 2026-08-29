# Benchmark

The benchmark runs 18 fixed synthetic cases through the same public agent path. A case passes only when all five audit gates pass. Audit Pass Rate is conformance to this declared contract, not model accuracy or real-world calibration.

## Cases

The query text is synthetic. Each Chinese query has an English explanation below.

| Case ID | Synthetic query | English explanation | Expected decision |
| --- | --- | --- | --- |
| `steady_7d` | `近 7 天正常吗` | Ask whether steady content behaved normally over the last 7 days. | `expected` |
| `steady_quarter` | `近一季度正常吗` | Ask whether steady content behaved normally over the last quarter, parsed as 90 days. | `expected` |
| `steady_half_month` | `近半个月正常吗` | Ask whether steady content behaved normally over the last half month, parsed as 15 days. | `expected` |
| `scale_healthy` | `近 7 天值得追投吗` | Ask whether healthy growth evidence supports scaling over the last 7 days. | `scale` |
| `scale_without_intent` | `近 7 天正常吗` | Ask for diagnosis, not scaling, even though the fixture is healthy enough to scale. | `expected` |
| `click_drop` | `近 7 天为什么掉了` | Ask why performance fell over 7 days when the click signal explains the decline. | `intervene` |
| `retention_drop` | `近 7 天为什么掉了` | Ask why performance fell over 7 days when the completion signal explains the decline. | `intervene` |
| `feed_drop` | `近 7 天为什么掉了` | Ask why performance fell over 7 days when the distribution path explains the decline. | `intervene` |
| `incomplete_data` | `近 7 天正常吗` | Ask for a 7-day diagnosis when completeness is too low; the honest result is to stop. | `insufficient_evidence` |
| `unknown_object` | `近 7 天正常吗` | Ask for a 7-day diagnosis of an entity that is not among the declared fixtures. | `insufficient_evidence` |
| `missing_object` | `近 7 天正常吗` | Ask for a 7-day diagnosis without supplying an entity ID. | `insufficient_evidence` |
| `explicit_30d` | `近 30 天正常吗` | Ask whether steady content behaved normally over an explicit 30-day window. | `expected` |
| `scale_click_drop` | `近 7 天值得追投吗` | Ask whether content with a click decline should scale over 7 days. | `intervene` |
| `scale_incomplete` | `近 7 天值得追投吗` | Ask whether incomplete evidence supports scaling; the honest result is to stop. | `insufficient_evidence` |
| `feed_drop_quarter` | `近一季度为什么掉了` | Ask why performance fell over a 90-day quarter when distribution evidence explains it. | `intervene` |
| `click_drop_quarter` | `近一季度为什么掉了` | Ask why performance fell over a 90-day quarter when click evidence explains it. | `intervene` |
| `healthy_no_window` | `现在正常吗` | Ask whether steady content is normal now; the parser uses its declared 7-day default. | `expected` |
| `healthy_scale_30d` | `近 30 天值得追投吗` | Ask whether healthy growth evidence supports scaling over an explicit 30-day window. | `scale` |

## Five gates

| Gate | What it checks |
| --- | --- |
| Request understanding | Parsed goal and time window equal the case contract. |
| Capability path | Every required capability ran and every forbidden capability did not. |
| Evidence coverage | All evidence IDs required by the case are present. |
| Decision correctness | The typed decision equals the case's declared expectation. |
| Honesty boundary | The run includes the declared synthetic, deterministic, no-production-action, and no-model-training notes. |

An `insufficient_evidence` result passes when the case requires an honest early stop. It is not counted as a failed prediction.

## Current snapshot

[`benchmark/latest.json`](../benchmark/latest.json) records 18/18 cases passing, with 18/18 for each of the five gates.

## Snapshot updates

- Run `npm run bench` to generate a local timing report and compare the stable snapshot byte for byte. A mismatch fails the command.
- Use `npm run bench:update` only after intentionally changing a fixed case or its public contract.
- Inspect the snapshot diff. Every changed case, gate, or expected decision must be explained in the pull request.
- Run `npm run verify` before proposing the updated snapshot.
- Never update the snapshot only to make a regression appear green.
