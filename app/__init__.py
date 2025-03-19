import logging
from flask import Flask, render_template
from flask_cors import CORS
from app.database import db

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def create_app():
    # Create the Flask app
    app = Flask(__name__)
    
    # Import here to avoid circular imports
    from app.services.config_service import ConfigService
    config_service = ConfigService()
    
    # Set app secret key
    app.secret_key = config_service.get_session_secret()
    
    # Configure the database
    db_url = config_service.get_database_url()
    if db_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    else:
        # Log warning if database URL is not configured
        logger.warning("Database URL not configured. Please set it in the settings page.")
        # Use SQLite as fallback
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///bot_meta.db"
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 2
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Initialize the app with the extension
    db.init_app(app)

    # Enable CORS
    CORS(app)

    # Import routes after app initialization to avoid circular imports
    from app.routes.webhook import webhook_bp
    from app.routes.tickets import tickets_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.settings import settings_bp
    from app.routes.analytics import analytics_bp

    # Register blueprints
    app.register_blueprint(webhook_bp, url_prefix='/webhook')
    app.register_blueprint(tickets_bp, url_prefix='/tickets')
    app.register_blueprint(settings_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(analytics_bp)

    # Main routes
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/settings')
    def settings():
        return render_template('settings.html')

    # Create database tables
    with app.app_context():
        # Import models here to ensure they're registered with SQLAlchemy
        from app.models import models
        db.create_all()
        logger.info("Database tables created")

    return app

# Create the application instance
app = create_app()