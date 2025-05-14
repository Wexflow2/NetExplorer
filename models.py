from datetime import datetime
from app import db

class BrowsingHistory(db.Model):
    """Model for storing browsing history entries."""
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.Text, nullable=False)
    title = db.Column(db.Text)
    visit_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<BrowsingHistory {self.url}>'

class Bookmark(db.Model):
    """Model for storing bookmarks."""
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.Text, nullable=False)
    title = db.Column(db.Text, nullable=False)
    favicon = db.Column(db.Text)
    category = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Bookmark {self.title}>'