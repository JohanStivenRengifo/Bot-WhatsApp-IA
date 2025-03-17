import os
import logging
from flask import Flask, render_template
from dotenv import load_dotenv
from database import db

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://main_db_owner:npg_lWfSt1yvu5Fi@ep-delicate-resonance-a5thlhhp-pooler.us-east-2.aws.neon.tech/main_db?sslmode=require"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
    "pool_size": 5,
    "max_overflow": 2
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the app with the extension
db.init_app(app)

# Import routes after app initialization to avoid circular imports
from whatsapp_webhook import webhook_bp
from ticket_system import tickets_bp
from appointment_scheduler import appointments_bp

# Register blueprints
app.register_blueprint(webhook_bp, url_prefix='/webhook')
app.register_blueprint(tickets_bp, url_prefix='/tickets')
app.register_blueprint(appointments_bp, url_prefix='/appointments')

# Main routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analytics')
def analytics():
    return render_template('analytics.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

# Create database tables
with app.app_context():
    # Import models here to ensure they're registered with SQLAlchemy
    import models
    db.create_all()
    logger.info("Database tables created")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
