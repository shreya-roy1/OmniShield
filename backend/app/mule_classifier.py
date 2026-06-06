import os
import joblib
import pandas as pd
import numpy as np

# Global variables to hold the loaded model and feature names
_MODEL = None
_FEATURE_NAMES = None
_CATEGORICAL_INFO = None
_DATASET_CACHE = None

def load_model(model_path: str = "app/mule_model.pkl"):
    """
    Loads the trained XGBoost model and feature names from disk.
    """
    global _MODEL, _FEATURE_NAMES, _CATEGORICAL_INFO
    if os.path.exists(model_path):
        try:
            model_data = joblib.load(model_path)
            _MODEL = model_data["model"]
            _FEATURE_NAMES = model_data["feature_names"]
            _CATEGORICAL_INFO = model_data.get("categorical_info", {})
            print(f"Successfully loaded ML model from {model_path}")
        except Exception as e:
            print(f"Failed to load ML model: {e}")
            _MODEL = None
            _FEATURE_NAMES = None
            _CATEGORICAL_INFO = None
    else:
        print(f"Model file {model_path} not found. ML classification will be disabled.")

def predict_mule_score(features: dict) -> dict:
    """
    Predicts the mule probability for a given feature dictionary.
    Returns the probability and top contributing features (using simple tree-based feature importances).
    """
    if _MODEL is None or _FEATURE_NAMES is None:
        raise ValueError("ML model is not loaded. Please train the model first.")

    # Convert the input dictionary to a DataFrame matching the training features
    # Missing features will be NaN, which XGBoost handles natively.
    df_input = pd.DataFrame([features], columns=_FEATURE_NAMES)
    
    # Cast categorical columns to the correct categories
    if _CATEGORICAL_INFO:
        for col, categories in _CATEGORICAL_INFO.items():
            if col in df_input.columns:
                cat_type = pd.CategoricalDtype(categories=categories, ordered=False)
                df_input[col] = df_input[col].astype(cat_type)
    
    # Predict probability of class 1 (Mule)
    prob = float(_MODEL.predict_proba(df_input)[0, 1])

    # To provide Explainable AI (XAI), we can look at the model's global feature importances
    # combined with the input values. A true SHAP explainer is better, but for speed,
    # we'll return the highest global importance features that are present in the input.
    importances = _MODEL.feature_importances_
    
    # Create a list of (feature_name, importance, value_in_input)
    feature_impacts = []
    for i, fname in enumerate(_FEATURE_NAMES):
        if importances[i] > 0:
            val = df_input.iloc[0, i]
            feature_impacts.append({
                "feature": fname,
                "importance": float(importances[i]),
                "value": float(val) if not pd.isna(val) else None
            })
            
    # Sort by importance descending and take top 10
    top_features = sorted(feature_impacts, key=lambda x: x["importance"], reverse=True)[:10]

    return {
        "mule_probability": prob,
        "is_suspicious": prob > 0.5,
        "top_contributing_features": top_features
    }

def get_random_test_sample(dataset_path: str = "../DataSet.csv") -> dict:
    """
    Fetches a random row from DataSet.csv for testing purposes.
    """
    global _DATASET_CACHE
    
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
        
    if _DATASET_CACHE is None:
        print("Caching a chunk of the dataset for fast sampling...")
        # Cache first 1000 rows to avoid reading 116MB every time
        _DATASET_CACHE = pd.read_csv(dataset_path, nrows=1000)
        
    sample = _DATASET_CACHE.sample(1).iloc[0]
    
    # Separate features and target
    target_val = float(sample["F3924"]) if "F3924" in sample else None
    
    # Convert to dict, dropping target and replacing NaNs with None for JSON serialization
    feature_dict = sample.drop(labels=["F3924"], errors="ignore").replace({np.nan: None}).to_dict()
    
    return {
        "actual_target": target_val,
        "features": feature_dict
    }
