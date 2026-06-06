import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report
import xgboost as xgb
import argparse
import time

def main():
    parser = argparse.ArgumentParser(description="Train XGBoost Classifier on Mule Account Dataset")
    parser.add_argument("--data", type=str, default="../DataSet.csv", help="Path to DataSet.csv")
    parser.add_argument("--output", type=str, default="app/mule_model.pkl", help="Output path for the trained model")
    parser.add_argument("--test-mode", action="store_true", help="Run in test mode (subsample data) for fast execution")
    args = parser.parse_args()

    print(f"Loading dataset from {args.data} ...")
    start_time = time.time()
    
    # In test mode, we read only a few rows to verify the pipeline works.
    if args.test_mode:
        df = pd.read_csv(args.data, nrows=5000)
        print("TEST MODE: Loaded top 5000 rows.")
    else:
        df = pd.read_csv(args.data)
        print(f"Loaded {len(df)} rows.")

    print(f"Data loading took {time.time() - start_time:.2f} seconds.")

    target_col = "F3924"
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in the dataset!")

    print(f"Cleaning dataset: dropping rows where target '{target_col}' is missing...")
    initial_len = len(df)
    df = df.dropna(subset=[target_col])
    print(f"Dropped {initial_len - len(df)} rows with missing target. {len(df)} rows remaining.")

    print("Splitting features and target...")
    X = df.drop(columns=[target_col])
    y = df[target_col]

    # Feature names for inference
    feature_names = list(X.columns)

    # Convert object columns to category and store category categories
    categorical_info = {}
    object_cols = X.select_dtypes(include=['object']).columns
    for col in object_cols:
        print(f"Converting column '{col}' to categorical...")
        X[col] = X[col].astype('category')
        categorical_info[col] = list(X[col].cat.categories)

    print("Splitting into train and test sets...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        objective='binary:logistic',
        use_label_encoder=False,
        eval_metric='auc',
        random_state=42,
        n_jobs=-1,
        tree_method='hist', # Fast histogram optimized for large datasets
        enable_categorical=True
    )
    
    train_start = time.time()
    model.fit(X_train, y_train)
    print(f"Training completed in {time.time() - train_start:.2f} seconds.")

    print("Evaluating model...")
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    print("\n--- Model Evaluation ---")
    print(f"Accuracy: {acc:.4f}")
    print(f"ROC-AUC:  {auc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    print(f"Saving model to {args.output}...")
    # Create directory if not exists
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Save a dictionary with the model, feature names, and category definitions
    model_data = {
        "model": model,
        "feature_names": feature_names,
        "categorical_info": categorical_info
    }
    joblib.dump(model_data, args.output)
    print("Model saved successfully!")

if __name__ == "__main__":
    main()
