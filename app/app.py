from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
import os
from keycloak import KeycloakOpenID
import requests
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load Keycloak configuration from JSON file
with open('keycloak-config.json') as f:
    keycloak_config = json.load(f)

# Initialize Keycloak OpenID client
keycloak_openid = KeycloakOpenID(server_url=keycloak_config['auth-server-url'],
                                 client_id=keycloak_config['resource'],
                                 realm_name=keycloak_config['realm'],
                                 client_secret_key=keycloak_config['credentials']['secret'])

def init_db():
    db_host = os.environ.get('DB_HOST')
    db_user = os.environ.get('DB_USER')
    db_password = os.environ.get('DB_PASSWORD')
    db_name = os.environ.get('DB_NAME')

    conn = mysql.connector.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
    )
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message VARCHAR(255) NOT NULL
    )
    """)
    cursor.execute("""
    INSERT INTO messages (message) 
    SELECT 'Hello World from Database!' 
    WHERE NOT EXISTS (SELECT * FROM messages)
    """)
    conn.commit()
    cursor.close()
    conn.close()

@app.route('/')
def hello():
    print("1")
    token = request.headers.get('Authorization', None)
    if not token:
        return jsonify(message="No token provided"), 401
    # Validate the token
    try:
        # validate the token in another way than introspect
        token_info = keycloak_openid.decode_token(token.split(' ')[1])
        # the introspect is not working (because front and back are using deffirent domains)
        # token_info = keycloak_openid.introspect(token.split(' ')[1])
    except requests.exceptions.RequestException as e:
        # log the error details
        print(e)
        print(e.response.text)
        return jsonify(message="Unable to validate token"), 500

    print(token_info)

    print("2")
    db_host = os.environ.get('DB_HOST')
    db_user = os.environ.get('DB_USER')
    db_password = os.environ.get('DB_PASSWORD')
    db_name = os.environ.get('DB_NAME')

    conn = mysql.connector.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
    )
    print("3")
    cursor = conn.cursor()
    cursor.execute("SELECT message FROM messages")
    result = cursor.fetchone()
    print("4")
    message = result[0] if result else "No message found"
    cursor.close()
    conn.close()
    print("5")
    return jsonify(message=message)

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)
