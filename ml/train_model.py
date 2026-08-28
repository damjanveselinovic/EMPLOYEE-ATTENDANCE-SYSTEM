"""
Trenira Random Forest i Gradient Boosting na sintetickom datasetu, poredi ih (i njihov
ensemble) preko cross-validation AUC-a, bira najbolji, testira na held-out test setu,
i izvozi rezultat za koriscenje u Node/Next.js.

Pokretanje:
    python train_model.py

Izlaz (u models/):
    burnout_model.onnx    <- istrenirani model, koristi Node (onnxruntime-node)
    feature_schema.json   <- redosled feature imena (MORA da se poklapa sa Node kodom)
    model_eval.json        <- sve metrike, za dokumentaciju u diplomskom
"""

import json
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import (
    GradientBoostingClassifier,
    RandomForestClassifier,
    VotingClassifier,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
)

from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

# MORA da se poklapa sa redosledom u ml/FEATURES.md i sa Node feature ekstrakcijom
FEATURE_ORDER = [
    "avg_hours_recent",
    "avg_hours_baseline",
    "hours_deviation",
    "pct_late_recent",
    "pct_absent_recent",
    "avg_arrival_hour_recent",
    "arrival_time_std_dev_recent",
    "trend_slope",
]

RANDOM_STATE = 42


def load_data():
    df = pd.read_csv(os.path.join("data", "synthetic_dataset.csv"))
    X = df[FEATURE_ORDER].values.astype(np.float32)
    y = df["label"].values.astype(int)
    return X, y


def evaluate_candidates(X_train, y_train):
    """5-fold CV AUC za RF, GB, i ensemble. Vraca dict {ime: (mean_auc, std_auc, model)}."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

    rf = RandomForestClassifier(
        n_estimators=200, max_depth=6, random_state=RANDOM_STATE
    )
    gb = GradientBoostingClassifier(
        n_estimators=150, max_depth=3, random_state=RANDOM_STATE
    )
    ensemble = VotingClassifier(
        estimators=[("rf", rf), ("gb", gb)], voting="soft"
    )

    candidates = {"random_forest": rf, "gradient_boosting": gb, "ensemble": ensemble}
    results = {}

    for name, model in candidates.items():
        scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="roc_auc")
        results[name] = (float(scores.mean()), float(scores.std()), model)
        print(f"{name:20s}  CV AUC = {scores.mean():.4f}  (+/- {scores.std():.4f})")

    return results


def main():
    X, y = load_data()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    print(f"Train: {len(X_train)} primera ({y_train.sum()} at-risk)")
    print(f"Test:  {len(X_test)} primera ({y_test.sum()} at-risk)")
    print("\n--- Cross-validation (5-fold) na train skupu ---")

    results = evaluate_candidates(X_train, y_train)

    best_name = max(results, key=lambda k: results[k][0])
    best_mean_auc, best_std_auc, best_model = results[best_name]
    print(f"\nNajbolji kandidat: {best_name} (CV AUC = {best_mean_auc:.4f})")

    # trening na celom train skupu
    best_model.fit(X_train, y_train)

    # evaluacija na held-out test skupu (model ga nije video tokom treninga/CV-a)
    test_proba = best_model.predict_proba(X_test)[:, 1]
    test_pred = best_model.predict(X_test)
    test_auc = roc_auc_score(y_test, test_proba)
    report = classification_report(y_test, test_pred, output_dict=True)
    cm = confusion_matrix(y_test, test_pred).tolist()

    print(f"\n--- Test set (held-out) ---")
    print(f"Test AUC: {test_auc:.4f}")
    print(classification_report(y_test, test_pred))
    print(f"Confusion matrix:\n{cm}")

    # feature importance (ako model to podrzava direktno; kod ensemble-a usrednjujemo)
    feature_importance = None
    if hasattr(best_model, "feature_importances_"):
        feature_importance = dict(
            zip(FEATURE_ORDER, best_model.feature_importances_.tolist())
        )
    elif best_name == "ensemble":
        rf_imp = best_model.named_estimators_["rf"].feature_importances_
        gb_imp = best_model.named_estimators_["gb"].feature_importances_
        avg_imp = (rf_imp + gb_imp) / 2
        feature_importance = dict(zip(FEATURE_ORDER, avg_imp.tolist()))

    if feature_importance:
        print("\nFeature importance:")
        for name, imp in sorted(
            feature_importance.items(), key=lambda kv: -kv[1]
        ):
            print(f"  {name:30s} {imp:.4f}")

    # --- izvoz ---
    os.makedirs("models", exist_ok=True)

    initial_type = [("input", FloatTensorType([None, len(FEATURE_ORDER)]))]
    onnx_model = convert_sklearn(
        best_model,
        initial_types=initial_type,
        target_opset=13,
        options={id(best_model): {"zipmap": False}},
    )
    onnx_path = os.path.join("models", "burnout_model.onnx")
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"\nModel sacuvan: {onnx_path}")

    schema_path = os.path.join("models", "feature_schema.json")
    with open(schema_path, "w") as f:
        json.dump({"feature_order": FEATURE_ORDER}, f, indent=2)
    print(f"Feature schema sacuvana: {schema_path}")

    eval_path = os.path.join("models", "model_eval.json")
    eval_data = {
        "chosen_model": best_name,
        "cv_results": {
            name: {"mean_auc": mean_auc, "std_auc": std_auc}
            for name, (mean_auc, std_auc, _) in results.items()
        },
        "test_auc": float(test_auc),
        "test_classification_report": report,
        "test_confusion_matrix": cm,
        "feature_importance": feature_importance,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "feature_order": FEATURE_ORDER,
    }
    with open(eval_path, "w") as f:
        json.dump(eval_data, f, indent=2)
    print(f"Metrike sacuvane: {eval_path}")


if __name__ == "__main__":
    main()