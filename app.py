import os
import logging
import urllib.parse
import requests
from flask import Flask, render_template, request, Response, redirect, url_for, abort, jsonify
from bs4 import BeautifulSoup
import re
from sqlalchemy.orm import DeclarativeBase
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Database setup
class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Configure the database
database_url = os.environ.get("DATABASE_URL")
if database_url:
    # Ensure the database URL is properly formatted
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
else:
    # Fallback for local development
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///netex.db"

app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the app with the extension
db.init_app(app)

# Create tables within app context
with app.app_context():
    # Import models here so tables will be created
    import models  # noqa: F401
    db.create_all()

# List of content types that should be handled as text
TEXT_CONTENT_TYPES = [
    'text/html', 
    'text/css', 
    'text/javascript', 
    'application/javascript',
    'application/json',
    'application/xml',
    'text/xml'
]

@app.route('/')
def index():
    """Render the main proxy interface."""
    return render_template('index.html')

@app.route('/search')
def search():
    """Handle Google search requests."""
    query = request.args.get('q', '')
    if not query:
        return redirect(url_for('index'))
        
    # Redirect to Google search with the query
    search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
    return redirect(f"/proxy?url={urllib.parse.quote(search_url)}")

@app.route('/proxy')
def proxy():
    """Proxy the requested URL and return the response."""
    url = request.args.get('url', '')
    
    if not url:
        return redirect(url_for('index'))
    
    # Ensure URL has a scheme
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    try:
        parsed_url = urllib.parse.urlparse(url)
        if not parsed_url.netloc:
            return render_template('error.html', error="Invalid URL format")
        
        logger.debug(f"Proxying request to: {url}")
        
        # Make the request to the target URL with improved headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
        }
        
        # Add special handling for YouTube domains
        if 'youtube.com' in url or 'youtu.be' in url:
            headers['Accept-Encoding'] = 'gzip, deflate, br'
            headers['Sec-Ch-Ua'] = '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"'
            logger.debug(f"Using YouTube-specific headers for: {url}")
        
        resp = requests.get(
            url, 
            headers=headers,
            allow_redirects=True,
            timeout=20
        )
        
        # Check if response is successful
        resp.raise_for_status()
        
        content_type = resp.headers.get('Content-Type', '').split(';')[0]
        
        # Record the visit in browsing history
        if resp.status_code == 200:
            # Try to extract title if it's HTML
            title = url  # Default title is the URL itself
            if 'text/html' in content_type:
                try:
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    title_tag = soup.find('title')
                    if title_tag and title_tag.string:
                        title = title_tag.string.strip()
                except Exception as e:
                    logger.error(f"Error extracting title: {e}")
            
            # Save to history
            try:
                from models import BrowsingHistory
                history_entry = BrowsingHistory(url=url, title=title)
                db.session.add(history_entry)
                db.session.commit()
                logger.debug(f"Added to history: {url}")
            except Exception as e:
                logger.error(f"Error saving to history: {e}")
                db.session.rollback()
        
        # Pass through binary content directly
        if not any(text_type in content_type for text_type in TEXT_CONTENT_TYPES):
            return Response(
                resp.content,
                status=resp.status_code,
                headers={
                    'Content-Type': resp.headers.get('Content-Type', 'application/octet-stream')
                }
            )
        
        # Special handling for YouTube to avoid issues with their scripts
        if 'youtube.com' in url or 'youtu.be' in url:
            logger.debug(f"Using YouTube-specific content handling for: {url}")
            # For YouTube, make sure we handle it as HTML and set a better timeout
            content_type = 'text/html' if not content_type else content_type
            
        # Rewrite links in HTML content
        if 'text/html' in content_type:
            html = resp.text
            soup = BeautifulSoup(html, 'html.parser')
            
            # Fix base URL for relative links
            base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
            
            # Rewrite URLs in attributes
            for attr_name in ['href', 'src', 'action']:
                for tag in soup.find_all(attrs={attr_name: True}):
                    original_url = tag[attr_name]
                    if not original_url.startswith(('http://', 'https://', 'data:', 'javascript:', '#', 'mailto:')):
                        if original_url.startswith('/'):
                            absolute_url = f"{base_url}{original_url}"
                        else:
                            path = os.path.dirname(parsed_url.path) if parsed_url.path else '/'
                            absolute_url = f"{base_url}{path}/{original_url}"
                        tag[attr_name] = f"/proxy?url={urllib.parse.quote(absolute_url)}"
                    elif original_url.startswith(('http://', 'https://')):
                        tag[attr_name] = f"/proxy?url={urllib.parse.quote(original_url)}"
            
            # Rewrite URLs in style attributes and CSS
            for tag in soup.find_all(style=True):
                base_url_copy = base_url  # Create a copy of base_url for the closure
                path_copy = parsed_url.path  # Create a copy of path for the closure
                tag['style'] = re.sub(r'url\([\'"]?([^\'")]+)[\'"]?\)', 
                                     lambda m, base=base_url_copy, path=path_copy: f'url({rewrite_css_url(m.group(1), base, path)})',
                                     tag['style'])
            
            # Rewrite CSS files
            for style_tag in soup.find_all('style'):
                if style_tag.string:
                    base_url_copy = base_url  # Create a copy of base_url for the closure
                    path_copy = parsed_url.path  # Create a copy of path for the closure
                    style_tag.string = re.sub(r'url\([\'"]?([^\'")]+)[\'"]?\)', 
                                             lambda m, base=base_url_copy, path=path_copy: f'url({rewrite_css_url(m.group(1), base, path)})',
                                             style_tag.string)
            
            return str(soup)
        
        # Rewrite URLs in CSS content
        elif 'text/css' in content_type:
            css_content = resp.text
            # Access base_url and path directly from parsed_url
            css_content = re.sub(r'url\([\'"]?([^\'")]+)[\'"]?\)', 
                               lambda m, base=f"{parsed_url.scheme}://{parsed_url.netloc}", path=parsed_url.path: 
                               f'url({rewrite_css_url(m.group(1), base, path)})',
                               css_content)
            return Response(css_content, content_type='text/css')
        
        # Return other text content as-is
        return Response(
            resp.text,
            status=resp.status_code,
            headers={
                'Content-Type': resp.headers.get('Content-Type', 'text/plain')
            }
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {str(e)}")
        return render_template('error.html', error=f"Failed to access {url}: {str(e)}")
    except Exception as e:
        logger.error(f"General error: {str(e)}")
        return render_template('error.html', error=f"An error occurred: {str(e)}")

@app.route('/history', methods=['GET'])
def history():
    """Retrieve browsing history."""
    from models import BrowsingHistory
    
    # Get browsing history ordered by most recent first
    history = BrowsingHistory.query.order_by(BrowsingHistory.visit_time.desc()).limit(50).all()
    
    # Return as JSON
    return jsonify([{
        'id': entry.id,
        'url': entry.url,
        'title': entry.title,
        'visit_time': entry.visit_time.isoformat()
    } for entry in history])

@app.route('/bookmarks', methods=['GET'])
def get_bookmarks():
    """Retrieve all bookmarks."""
    from models import Bookmark
    
    # Get all bookmarks ordered by most recent first
    bookmarks = Bookmark.query.order_by(Bookmark.created_at.desc()).all()
    
    # Return as JSON
    return jsonify([{
        'id': bookmark.id,
        'url': bookmark.url,
        'title': bookmark.title,
        'favicon': bookmark.favicon,
        'category': bookmark.category,
        'created_at': bookmark.created_at.isoformat()
    } for bookmark in bookmarks])

@app.route('/bookmarks', methods=['POST'])
def add_bookmark():
    """Add a new bookmark."""
    from models import Bookmark
    
    data = request.json
    if not data or 'url' not in data or 'title' not in data:
        return jsonify({'error': 'URL and title are required'}), 400
    
    # Create new bookmark
    bookmark = Bookmark(
        url=data['url'],
        title=data['title'],
        favicon=data.get('favicon', ''),
        category=data.get('category', 'Uncategorized')
    )
    
    db.session.add(bookmark)
    db.session.commit()
    
    return jsonify({
        'id': bookmark.id,
        'url': bookmark.url,
        'title': bookmark.title,
        'favicon': bookmark.favicon,
        'category': bookmark.category,
        'created_at': bookmark.created_at.isoformat()
    }), 201

@app.route('/bookmarks/<int:bookmark_id>', methods=['DELETE'])
def delete_bookmark(bookmark_id):
    """Delete a bookmark by ID."""
    from models import Bookmark
    
    bookmark = Bookmark.query.get_or_404(bookmark_id)
    db.session.delete(bookmark)
    db.session.commit()
    
    return jsonify({'message': 'Bookmark deleted successfully'}), 200

def rewrite_css_url(url, base_url, path):
    """Rewrite URLs in CSS content."""
    if url.startswith(('http://', 'https://', 'data:')):
        return f'/proxy?url={urllib.parse.quote(url)}'
    elif url.startswith('/'):
        return f'/proxy?url={urllib.parse.quote(base_url + url)}'
    else:
        # Relative URL
        dir_path = os.path.dirname(path) if path else '/'
        if not dir_path.endswith('/'):
            dir_path += '/'
        return f'/proxy?url={urllib.parse.quote(base_url + dir_path + url)}'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
