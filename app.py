from flask import Flask, request, jsonify, render_template
import json
import os

app = Flask(__name__)

FILE_PATH = "product_list.json"

def load_products():
    if os.path.exists(FILE_PATH):
        with open(FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_products(data):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/get_products")
def get_products():
    return jsonify(load_products())

@app.route("/save_products", methods=["POST"])
def save():
    data = request.json
    save_products(data)
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run()