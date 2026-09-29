"""Export data for the 3D web dashboard in web/.

    python scripts/export_web_data.py                  # verified results + every 60 s test-drive replay
    python scripts/export_web_data.py --summary-only   # verified results only (no dataset or torch needed)

Writes, under web/public/data/:
    verified.json               per-window results of the reported MVP run, read from results/sih/
    replays/<drive>_<t>.json    real engine replays (variant D, sih_mvp profile, passenger car kinematics)
    index.json                  which replays exist, for the front-end

Each replay comes from src.ui.sim.replay_window, which reproduces src.evaluate window for window (the same
path the Streamlit dashboard uses). Nothing is resampled or smoothed: every sample of the 10 Hz engine output
between 20 s before GNSS loss and 15 s after it returns is written. The replay's drift is checked against the
verified results file and the export fails if they disagree. Positions are local metres (East, North)
relative to the car's true position at GNSS loss; no latitude/longitude is written.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.chdir(ROOT)            # configs, data and model paths are relative to the repo root

import numpy as np        # noqa: E402
import pandas as pd       # noqa: E402

OUT_DIR = os.path.join("web", "public", "data")
BEFORE_S, AFTER_S = 20.0, 15.0
SCHEMA = 1
MODES = ["WAITING FOR GNSS", "GNSS+INS", "DEAD RECKONING"]          # src.engine MODE_INIT, MODE_GNSS, MODE_DR
SOURCES = ["gnss_pos", "gnss_speed", "gnss_heading", "motionnet", "nhc", "zupt", "zaru",
           "map_position", "map_heading"]                              # EKF2D update sources
DRIFT_TOLERANCE_PCT = 0.05                                             # replay vs verified results file


def _num(v, nd: int):
    """Round for JSON; NaN/inf -> null."""
    v = float(v)
    return None if not math.isfinite(v) else round(v, nd)


def _col(values, nd: int) -> list:
    return [_num(v, nd) for v in values]


def _write(path: str, obj) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = json.dumps(obj, separators=(",", ":"), allow_nan=False)
    with open(path, "w") as f:
        f.write(text)
    return len(text)


# ---------------------------------------------------------------- verified results (no dataset needed)
def export_verified() -> pd.DataFrame:
    from src.ui import sim

    df = pd.read_csv(sim.VERIFIED_CSV)
    summary = []
    for dur, g in df.groupby("duration_s"):
        d, a = g[g.variant == "D"], g[g.variant == "A"]
        summary.append(dict(durationS=float(dur), windows=int(len(d)),
                            meanDistanceM=_num(d.distance_m.mean(), 1),
                            medianDriftPct=_num(d.drift_percent.median(), 2),
                            meanDriftPct=_num(d.drift_percent.mean(), 2),
                            rawInsMedianDriftPct=_num(a.drift_percent.median(), 2)))
    d60 = df[(df.variant == "D") & (df.duration_s == sim.DURATION_S)].sort_values(["drive", "t_start"])
    windows = [dict(drive=r.drive, tStart=float(r.t_start), driftPct=_num(r.drift_percent, 3),
                    endpointErrorM=_num(r.endpoint_error_m, 2), distanceM=_num(r.distance_m, 1),
                    ateM=_num(r.ate_m, 2), speedRmseMps=_num(r.speed_rmse_mps, 3),
                    headingMaeDeg=_num(r.heading_mae_deg, 2), reacqMaxStepM=_num(r.reacq_max_step_m, 2),
                    anomShock=int(r.anom_shock), anomTransient=int(r.anom_transient), anomSlip=int(r.anom_slip))
               for r in d60.itertuples()]
    n = _write(os.path.join(OUT_DIR, "verified.json"), dict(
        schema=SCHEMA, source=sim.VERIFIED_CSV, variant=sim.VARIANT, profile=sim.PROFILE,
        testDrives=sorted(d60.drive.unique().tolist()), summary=summary, windows60s=windows))
    med = {s["durationS"]: s["medianDriftPct"] for s in summary}
    print(f"verified.json  {n / 1e3:.1f} kB  median drift (D): " + ", ".join(f"{k:.0f} s {v}%" for k, v in med.items()))
    return d60


# ---------------------------------------------------------------- engine replays (dataset + model needed)
def _replay_json(r, drive_id: str, cfg: dict, verified_drift: float) -> dict:
    from src.ui import sim

    f = sim.display_slice(r, BEFORE_S, AFTER_S, step=1)
    w = r.window
    at_loss = f.index[f.rel_t >= 0][0]
    ax, ay = float(f.truth_x.iloc[at_loss]), float(f.truth_y.iloc[at_loss])
    t0, t1 = float(f.t.iloc[0]), float(f.t.iloc[-1])

    u = r.updates
    u = u[(u.t >= t0 - 1e-6) & (u.t <= t1 + 1e-6)]
    unknown = sorted(set(u.source) - set(SOURCES))
    if unknown:
        raise ValueError(f"unknown EKF update source(s) {unknown}; add them to SOURCES")
    anomalies = [dict(relT=_num(t - w.t_start, 3), kind=str(k), magnitude=_num(mag, 3), mode=str(mode))
                 for t, k, mag, mode in r.anomalies if t0 <= t <= t1]

    fc = cfg["filter"]
    m = r.metrics
    return dict(
        schema=SCHEMA, source="engine", id=f"{drive_id}_{w.t_start:.0f}", drive=drive_id,
        tStart=float(w.t_start), tEnd=float(w.t_end), durationS=float(w.duration),
        rateHz=_num(1.0 / np.median(np.diff(f.t.to_numpy())), 3), samples=int(len(f)),
        anchor=dict(x=_num(ax, 3), y=_num(ay, 3), note="drive-local ENU metres of the true position at GNSS loss"),
        profile=dict(config=sim.PROFILE, variant=sim.VARIANT, leverArmX=fc["lever_arm_x"], nhcSigma=fc["nhc_sigma"],
                     gnssTimeoutS=fc["gnss_timeout_s"]),
        metrics=dict(driftPct=_num(m["drift_percent"], 3), endpointErrorM=_num(m["endpoint_error_m"], 2),
                     distanceM=_num(m["distance_m"], 1), ateM=_num(m["ate_m"], 2),
                     speedRmseMps=_num(m["speed_rmse_mps"], 3), headingMaeDeg=_num(m["heading_mae_deg"], 2),
                     reacqMaxStepM=_num(m["reacq_max_step_m"], 2)),
        verifiedDriftPct=_num(verified_drift, 3),
        gnssUpdatesInBlackout=int(r.gnss_updates_in_blackout), mountYawDeg=_num(r.mount_yaw_deg, 2),
        modes=MODES, sources=SOURCES,
        columns=dict(
            relT=_col(f.rel_t, 3),
            x=_col(f.x - ax, 2), y=_col(f.y - ay, 2), yaw=_col(f.yaw, 4),
            vF=_col(f.v_f, 3), vL=_col(f.v_l, 3),
            posSigma=_col(f.pos_sigma, 3), pXX=_col(f.p_xx, 4), pYY=_col(f.p_yy, 4), pXY=_col(f.p_xy, 4),
            mode=[MODES.index(v) for v in f["mode"]], denied=[int(v) for v in f.denied],
            truthX=_col(f.truth_x - ax, 2), truthY=_col(f.truth_y - ay, 2), truthYaw=_col(f.truth_yaw, 4),
            truthSpeed=_col(f.truth_speed, 3),
            mnSpeed=_col(f.motionnet_speed, 3), mnSigma=_col(f.motionnet_sigma, 3),
            posError=_col(f.pos_error, 2), blackoutDist=_col(f.blackout_dist, 1)),
        updates=dict(relT=_col(u.t - w.t_start, 3), source=[SOURCES.index(s) for s in u.source],
                     accepted=[int(a) for a in u.accepted], nis=_col(u.nis, 2)),
        anomalies=anomalies,
    )


def export_replays(d60: pd.DataFrame) -> None:
    from src.ui import sim

    cfg = sim.load_cfg()
    model = sim.load_model(cfg)
    entries = []
    for drive_id in sim.test_drives(cfg):
        drive = sim.load_test_drive(cfg, drive_id)
        network = sim.road_network(cfg, drive)
        windows = sim.blackout_windows(cfg, drive)
        ver = d60[d60.drive == drive_id]
        drifts = {}
        for w in windows:
            v = ver[np.isclose(ver.t_start, w.t_start)]
            if len(v) != 1:
                raise ValueError(f"{drive_id} t={w.t_start}: no verified result for this window")
            verified = float(v.drift_percent.iloc[0])
            r = sim.replay_window(cfg, drive, w, model, network)
            got = float(r.metrics["drift_percent"])
            if abs(got - verified) > DRIFT_TOLERANCE_PCT:
                raise AssertionError(f"{drive_id} t={w.t_start}: replay drift {got:.3f}% != verified {verified:.3f}%")
            obj = _replay_json(r, drive_id, cfg, verified)
            name = f"{obj['id']}.json"
            n = _write(os.path.join(OUT_DIR, "replays", name), obj)
            drifts[w.t_start] = verified
            entries.append(dict(id=obj["id"], drive=drive_id, tStart=float(w.t_start), durationS=float(w.duration),
                                driftPct=_num(verified, 3), file=f"replays/{name}"))
            print(f"{name:<18} {n / 1e3:6.1f} kB  drift {got:6.2f}% (verified {verified:6.2f}%)  "
                  f"{obj['samples']} samples, {len(obj['updates']['relT'])} EKF updates, "
                  f"{len(obj['anomalies'])} anomalies")
        # the default window per drive is its median-drift window (as in the Streamlit app), not the best one
        ranked = sorted(drifts, key=drifts.get)
        median_t = ranked[len(ranked) // 2]
        for e in entries:
            if e["drive"] == drive_id:
                e["median"] = bool(math.isclose(e["tStart"], median_t))
    default = next(e["id"] for e in entries if e["median"])
    _write(os.path.join(OUT_DIR, "index.json"), dict(schema=SCHEMA, source="engine", defaultId=default,
                                                     replays=entries))
    print(f"index.json     {len(entries)} replays, default {default}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--summary-only", action="store_true", help="only write verified.json")
    args = ap.parse_args(argv)
    d60 = export_verified()
    if not args.summary_only:
        export_replays(d60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
