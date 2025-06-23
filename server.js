const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const BOOKS_FILE = path.join(__dirname, 'books.json');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(express.static('public'));

// Load books from file or initialize empty array
let books = [];
try {
  if (fs.existsSync(BOOKS_FILE)) {
    const data = fs.readFileSync(BOOKS_FILE, 'utf8');
    books = JSON.parse(data);
    console.log(`Loaded ${books.length} books from storage`);
  } else {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
    console.log('Created new books storage file');
  }
} catch (err) {
  console.error('Error loading books:', err);
}

// Helper function to save books to file
const saveBooks = () => {
  try {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving books:', err);
    return false;
  }
};

// POST: Add book
app.post('/add-book', (req, res) => {
  try {
    const contentType = req.headers['content-type'];

    if (contentType && contentType.includes('application/json')) {
      const { title, author, year, type } = req.body;
      
      // Basic validation
      if (!title || !author || !year || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const book = {
        id: Date.now().toString(), // Generate unique ID
        title,
        author,
        year: parseInt(year),
        type,
        addedOn: new Date().toISOString()
      };
      
      books.push(book);
      
      if (saveBooks()) {
        res.status(201).json({
          status: 'success',
          message: 'Book added successfully',
          book
        });
      } else {
        res.status(500).json({ error: 'Failed to save book' });
      }
    } else if (contentType && contentType.includes('application/xml')) {
      xml2js.parseString(req.body, (err, result) => {
        if (err) {
          return res.status(400).send('Invalid XML');
        }
        
        const bookData = result.book;
        if (!bookData || !bookData.title || !bookData.author || !bookData.year || !bookData.type) {
          return res.status(400).send('<error>Missing required fields</error>');
        }
        
        const newBook = {
          id: Date.now().toString(),
          title: bookData.title[0],
          author: bookData.author[0],
          year: parseInt(bookData.year[0]),
          type: bookData.type[0],
          addedOn: new Date().toISOString()
        };
        
        books.push(newBook);
        
        if (saveBooks()) {
          const builder = new xml2js.Builder();
          const responseXml = builder.buildObject({
            response: {
              status: 'success',
              message: 'Book added successfully',
              book: newBook
            }
          });
          res.set('Content-Type', 'application/xml');
          res.status(201).send(responseXml);
        } else {
          res.status(500).send('<error>Failed to save book</error>');
        }
      });
    } else {
      res.status(415).send('Unsupported Media Type');
    }
  } catch (error) {
    console.error('Error in add-book endpoint:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Return all books
app.get('/books', (req, res) => {
  try {
    const accept = req.headers['accept'];
    
    if (accept && accept.includes('application/xml')) {
      const builder = new xml2js.Builder();
      const xml = builder.buildObject({ books: { book: books } });
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } else {
      res.json(books);
    }
  } catch (error) {
    console.error('Error in get books endpoint:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE: Remove a book by ID
app.delete('/books/:id', (req, res) => {
  try {
    const bookId = req.params.id;
    const initialLength = books.length;
    
    books = books.filter(book => book.id !== bookId);
    
    if (books.length === initialLength) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    if (saveBooks()) {
      res.json({ status: 'success', message: 'Book deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save changes' });
    }
  } catch (error) {
    console.error('Error in delete book endpoint:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Server health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'up', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`📚 Book Tracker API running at http://localhost:${PORT}`);
});