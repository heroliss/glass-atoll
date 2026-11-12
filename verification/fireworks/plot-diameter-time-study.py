"""Standalone scientific figures for the CPU research; no runtime asset output."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent
data = json.loads((root / "diameter-time-study.json").read_text(encoding="utf-8"))
cols = {key: i for i, key in enumerate(data["curveColumns"])}
types = ["peony", "chrysanthemum", "willow", "palm", "ring", "heart", "crossette", "strobe", "fan", "bouquet"]
labels = {item["type"]: item["label"] for item in data["summaries"]}
plt.rcParams.update({"font.family": "Microsoft YaHei", "axes.unicode_minus": False, "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})

def curve(kind, scale=1):
    return next(item for item in data["cases"] if item["type"] == kind and item["seed"] == 42 and item["windSpeed"] == 0 and item["scale"] == scale)

def summary(kind, scale=1):
    return next(item for item in data["summaries"] if item["type"] == kind and item["seed"] == 42 and item["windSpeed"] == 0 and item["velocityDispersionScale"] == scale)

fig, axes = plt.subplots(2, 5, figsize=(18.5, 8.0), constrained_layout=True)
styles = [("D_bornGeometry3D_m", "#929aa0", "--", "已出生几何（含灭光/地下）"), ("D_live3D_m", "#25394d", "-", "存活且地上"), ("D_I01_3D_m", "#d28b28", "-", "固定参考1%门限"), ("D_I10_3D_m", "#178b7e", "-", "固定参考10%门限")]
for ax, kind in zip(axes.flat, types):
    values = curve(kind)["samples"]
    times = [v[0] for v in values]
    for key, colour, style, label in styles:
        ax.plot(times, [v[cols[key]] for v in values], color=colour, linestyle=style, linewidth=1.5, label=label)
    info = summary(kind)
    ax.axvspan(info["mainVisual"]["E10"], info["mainVisual"]["E90"], color="#b6d9d2", alpha=.2)
    ax.set_title(labels[kind] + (" · 发射后" if info["ground"] else " · 爆开后"), fontsize=12)
    ax.set_xlabel("物理时间 / s")
    ax.set_ylabel("3D中心间直径 / m")
    ax.grid(alpha=.18)
    ax.set_xlim(0, times[-1])
handles, legend_labels = axes.flat[0].get_legend_handles_labels()
fig.suptitle("D(t)口径研究：相同seed42、80°、无风、原物理参数；阴影为发光量E10–E90\n研究诊断，不是已标定产品尺寸或真实照片测光", fontsize=15)
fig.legend(handles, legend_labels, loc="outside lower center", ncol=4, frameon=False)
fig.savefig(root / "diameter-time-curves.png", dpi=160)
plt.close(fig)

fig, axes = plt.subplots(2, 2, figsize=(14.5, 9.0), constrained_layout=True)
colours = {0.75: "#168d7e", 1: "#243d58", 1.25: "#c47a38"}
for scale in [.75, 1, 1.25]:
    item = curve("ring", scale)
    times = [v[0] for v in item["samples"]]
    axes[0, 0].plot(times, [v[cols["D_I10_3D_m"]] for v in item["samples"]], label=f"s={scale:g}", color=colours[scale])
    axes[0, 1].plot(times, [v[cols["minLiveY_m"]] for v in item["samples"]], label=f"s={scale:g}", color=colours[scale])
    axes[1, 0].plot(times, [v[cols["sumSceneAuthoredCd"]] for v in item["samples"]], label=f"s={scale:g}", color=colours[scale], alpha=.85)
axes[0, 0].set_title("笑脸：固定10%参考门限的可见宽度")
axes[0, 0].set_ylabel("D10 / m")
axes[0, 1].set_title("笑脸：最低地上存活星，保留真实重力/地面裁切")
axes[0, 1].set_ylabel("世界Y / m")
axes[0, 1].axhline(.03, color="#9ba1a6", linestyle="--", linewidth=1)
axes[1, 0].set_title("星体源信号近乎重合：不是靠加减I伪造半径")
axes[1, 0].set_ylabel("Σ作者参考I / cd（非流明/像素）")
for ax in [axes[0, 0], axes[0, 1], axes[1, 0]]:
    ax.set_xlabel("爆后物理时间 / s")
    ax.legend(frameon=False)
    ax.grid(alpha=.18)
frame = {item["type"]: item for item in data["framing"]}
x = list(range(len(types)))
axes[1, 1].bar([v-.2 for v in x], [frame[k]["directOnly"]["radiusMetres"] for k in types], .4, label="完整直视＋岛", color="#243d58")
axes[1, 1].bar([v+.2 for v in x], [frame[k]["directAndFullPlanarMirror"]["radiusMetres"] for k in types], .4, label="再加完整平面倒影", color="#b0c9cb")
axes[1, 1].set_xticks(x, [labels[k] for k in types], rotation=35, ha="right")
axes[1, 1].set_title("默认参数包围参考：28mm、eye16m、16方位")
axes[1, 1].set_ylabel("到target半径 / m")
axes[1, 1].legend(frameon=False)
axes[1, 1].grid(axis="y", alpha=.18)
fig.suptitle("单参出生速度离差敏感性与全倒影构图代价\n非逐帧缩坐标；物理火星半径、寿命、I、RNG、火箭和重力均保留", fontsize=15)
fig.savefig(root / "diameter-time-sensitivity.png", dpi=160)
plt.close(fig)
print(json.dumps({"figures": ["diameter-time-curves.png", "diameter-time-sensitivity.png"], "sourcePhysics": data["sourceSHA256"]["physics"]}))
