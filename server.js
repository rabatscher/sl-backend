import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import admin from 'firebase-admin'; // Import Firebase Admin SDK
import fs from 'fs'; // To read the service account file
import path from 'path'; // For path resolution
import * as cheerio from "cheerio";


import fetch from "node-fetch";

// ✅ Use environment variable
const uri = process.env.MONGODB_URI;

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccountPath = path.resolve('sl-app-dc37f-firebase-adminsdk-fbsvc-ed47ed4002.json');  // Path to your service account key
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')); // Read and parse the JSON file

// Initialize Firebase Admin SDK with the service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware for authenticating JWT using Firebase Admin SDK
const authMiddleware = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Authorization header
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        // Verify the token with Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Fetch the corresponding MongoDB user by Firebase uid
        const user = await User.findOne({ uid: decodedToken.uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found in database' });
        }

        // Attach the MongoDB user _id to the request
        req.user = { _id: user._id, uid: decodedToken.uid };
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error("Token verification failed:", error.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// MongoDB Connection lAebpr71rvO2sa5D
// mongoose.connect('mongodb://localhost:27017/SL', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// });
  // mongoose.connect('mongodb://localhost:27017/SL')
  //     .then(() => console.log("✅ MongoDB connected successfully"))
    
  

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => {
  console.log("✅ Connected to MongoDB");
});

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

//       ONLINE DB

//     .then(() => console.log("✅ MongoDB connected successfully"))
//     .catch(err => console.error("❌ MongoDB connection error:", err));


// MongoDB Schema Definitions
const itemSchema = new mongoose.Schema({
    gtin: {type: String, required: true, unique: true },
    history: {type: Array},
    patentablauf: {type: mongoose.Schema.Types.ObjectId, ref: 'Patentablauf' }

});
const Item = mongoose.model('Item', itemSchema, 'sl2');

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    name: String,
    email: { type: String, required: true, unique: true },
    photo: String,
    dataDisclaimerAccepted: {type: Boolean, default: false},
    searchPreferences: {
        type: Object, 
        showExFactoryPrice: {type: Boolean, default: false},
        showPublicPrice: {type: Boolean, default: false} 
    }
});
const User = mongoose.model('User', userSchema, 'user');

const favoriteSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: Boolean, default: true },
});
const Favorite = mongoose.model('Favorite', favoriteSchema);

const patentablaufSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    GTIN: { type: Number, required: true },
    // 'Art der Änderung': { type: String, required: true },
    // 'Präparat': { type: String, required: true },
    // 'Gal. Form': { type: String, required: true },
    // 'Dosierung': { type: String, required: true },
    // 'Packung': { type: String, required: true },
    // 'Preis Vormonat FAP': { type: Number, required: true }, // Price from the previous month (FAP)
    // 'Preis Vormonat PP': { type: Number, required: true },  // Price from the previous month (PP)
    // 'FAP per 01.03.2024': { type: Number, required: true }, // FAP per 01.03.2024
    // 'PP per 01.03.2024': { type: Number, required: true },  // PP per 01.03.2024
    // 'Swissmedic-Liste': { type: String, required: true },
    // 'Swissmedic-Nr.': { type: Number, required: true },
    // 'Zulassungsinhaberin': { type: String, required: true },
    // 'BAG-Dossier': { type: Number, required: true },
    // 'Aufnahme / Streichung': { type: Number, required: false },
    // 'Befristung bis': { type: Number, required: false },
    // 'Preismodell ja/nein (mit Lim. in neuem TB)': { type: String, required: true },
    // 'Limitio Änderung ja (mit Lim. in neuem TB)': { type: String, required: true },
    // 'Lim-Pkte': { type: Number, required: false },
    // '20% Selbstbehalt': { type: String, required: true },
    // 'Generika': { type: String, required: true },
    // 'Therap. Gruppe': { type: String, required: true },
    // 'ATC': { type: String, required: true },
    // 'Substanzen': { type: String, required: true },
    // 'SMC-Nr Parallelimport': { type: Number, required: false },
    // 'GGSL': { type: String, required: true }
});


const Patentablauf = mongoose.model('Patentablauf', patentablaufSchema, 'patentablauf');

// Route to get all items (pagination)
app.get("/items", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const items = await Item.find().skip(skip).limit(limit).exec();
    res.json(items);
});

// ✅ Fetch a single item by GTIN
app.get("/itemDetail/:id", async (req, res) => {
    
    try {
        //const gtin = Number(req.params.gtin); // Convert to integer

        const item = await Item.findOne({ _id: req.params.id })
            .populate('patentablauf', {strictPopulate: false})  // populate without strictPopulate
            .exec();
            const patentablauf = await Patentablauf.findById(item.patentablauf).exec();
console.log(patentablauf);

            console.log('Type of patentablaufId:', item); // It should log 'object' (ObjectId)

        
        console.log(JSON.stringify(item._id))
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

    //   const patentablauf = await Patentablauf.findById(item.patentablauf).exec();

    //   if (!patentablauf) {
    //     return res.status(404).json({ message: 'Patentablauf not found' });
    //   }
  
      // Return the item and patentablauf
    //   res.status(200).json({ item, patentablauf });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Error fetching item", error });
    }
  });

// Route to search items by query
app.get('/items/search', async (req, res) => {
    
    try {
        const query = req.query.q;
        const type = req.query.type;
        if (!query) {
            return res.status(400).json({ error: "Query parameter 'q' is required" });
        }

        let searchQuery = {};
        const pipeline = [];
        


        if (type === "Substanz") {
            // console.log(type)
            // Search only within history.Substanzen
            searchQuery = { "history.Substanzen": { $regex: query, $options: "i" } };
        } else {
            // Default search (Bezeichnung and Hersteller)
            searchQuery = [
                {
                  $addFields: {
                    latestHistory: {
                      $arrayElemAt: [
                        {
                          $sortArray: {
                            input: "$history",
                            sortBy: { date: -1 }, // Sort history by newest date first
                          },
                        },
                        0, // Select the first element (most recent)
                      ],
                    },
                  },
                },
                {
                  $match: {
                    $or: [
                      { "latestHistory.Bezeichnung": { $regex: query, $options: "i" } },
                      { "latestHistory.Hersteller": { $regex: query, $options: "i" } },
                      { "latestHistory.Substanzen": { $regex: query, $options: "i" } },
                    ],
                  },
                },
                // {
                //     $project: { "history.Bezeichnung": 1, "history.Hersteller": 1 }
                // }
              ];
            // searchQuery = {
            //     $or: [
            //         { "history.Bezeichnung": { $regex: query, $options: "i" } },  
            //         { "history.Hersteller": { $regex: query, $options: "i" } }    ,
            //         {"history.Substanzen": { $regex: query, $options: "i" } }
            //     ]
            // };
        }     
        

        // const results = await Item.find({
            //     "history.Bezeichnung": { $regex: query, $options: "i" }
            // }).limit(50);
            // const results = await Item.find(searchQuery).limit(500);
            // const results = await Item.aggregate(searchQuery).limit(500);
            // const results = await Item.aggregate(pipeline).allowDiskUse(true);  // Allow disk use for large datasets

            const results = await Item.aggregate([

                {
                  $match: {
                    // $text: {
                    //   $search: `${query}*`,  // The query string you're searching for
                    // }


                    $or: [
                      { "history.Bezeichnung": { $regex: `^${query}`, $options: "i" } },
                      { "history.Hersteller": { $regex: `^${query}`, $options: "i" } }
                    ]

                  }
                },
                { $limit: 500 },
                // {$project: { "history.Bezeichnung": 1, "history.Hersteller": 1, "history." }}
                // Other stages, if necessary (e.g., $project, $sort)
              ]);
            

// ONLINE DB!
// const results = await Item.aggregate([
//   {
//     $search: {
//       index: "default",  // your Atlas Search index
//       wildcard: {
//         query: `${query}*`, // wrap in * for partial match
//         path: [
//           "history.Bezeichnung",
//           "history.Hersteller",
//           "history.Substanzen"
//         ],
//         allowAnalyzedField: true
//       }
//     }
//   },
//   { $limit: 500 },
//   {
//     $project: {
//       "history.Bezeichnung": 1,
//       "history.Hersteller": 1,
//       "history.Substanzen": 1,
//       score: { $meta: "searchScore" }
//     }
//   }
// ]);

//             const results = await Item.aggregate([
//   {
//     $search: {
//       index: "default", // your search index name
//       autocomplete: {
//         query: query,
//         path: [
//           "history.Bezeichnung",
//           "history.Hersteller",
//           "history.Substanzen"
//         ],
//         fuzzy: {
//           maxEdits: 1   // allow small typos
//         }
//       }
//     }
//   },
//   { $limit: 20 },
//   {
//     $project: {
//       "history.Bezeichnung": 1,
//       "history.Hersteller": 1,
//       "history.Substanzen": 1,
//       score: { $meta: "searchScore" }
//     }
//   }
// ]);

            
            // console.log(results)

        res.json(results);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// Search related items
app.get("/itemsRelated", async (req, res) => {
    try {
      const { name } = req.query;
      if (!name) return res.status(400).json({ error: "Missing name parameter" });
  
      const relatedItems = await Item.find({ "history.0.Name.Name": name }).limit(30);
      res.json(relatedItems);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/itemsGeneric", async (req, res) => {
    try {
      const { ATC } = req.query;
      if (!ATC) return res.status(400).json({ error: "Missing name parameter" });
  
      const genericItems = await Item.find({ "history.0.ATC": ATC }).limit(50);
      res.json(genericItems);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ error: "Server error" });
    }
  });  

  // Route to create or update a user
  app.get("/users", authMiddleware, async (req, res) => {
      try {
        //   const  uid = req.params.uid;
        const uid =  req.user.uid;
          console.log(uid)
          const user = await User.findOne({uid: uid});
  
          res.status(200).json(user);
      } catch (error) {
          res.status(500).json({ message: "Error saving user" });
      }
  });

  app.get("/count", async (req, res) => {
    try {
        const count = await Item.countDocuments();
        res.json({ count });
    } catch (error) {
        console.error("Error counting documents:", error);
        res.status(500).json({ error: "Server error" });
    }
});


// Route to create or update a user
app.post("/users", async (req, res) => {
    try {
        const { uid, name, email, photo } = req.body;

        let user = await User.findOne({ uid });
        if (!user) {
            user = new User({ uid, name, email, photo, dataDisclaimerAccepted: false, searchPreferences: {showExFactoryPrice: false, showPublicPrice: false} });
            await user.save();
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Error saving user" });
    }
});


app.get("/users/dataDisclaimerStatus", authMiddleware, async (req, res) => {
    try {
      const userId = req.user._id;
      
  
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.json({ dataDisclaimerAccepted: user.dataDisclaimerAccepted });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });


app.put("/users/dataDisclaimerAccepted", authMiddleware, async (req, res) => {
    // const { userId } = req.session; // Get the logged-in user's userId from session
    const userId = req.user._id;
  
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { dataDisclaimerAccepted: true }
      );
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.json({ message: "Data confirmation updated successfully", user });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });


app.put("/users/searchPreferences", authMiddleware, async (req, res) => {
    // const { userId } = req.session; // Get the logged-in user's userId from session
    const userId = req.user._id;
    const { showPublicPrice, showExFactoryPrice } = req.body;

    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { searchPreferences: {showPublicPrice, showExFactoryPrice }},
        { new: true } // This option returns the updated document

    );
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.json({ message: "Data confirmation updated successfully", user });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });


// Route to toggle favorite status
app.post('/favorites', authMiddleware, async (req, res) => {
    const { itemId } = req.body;
    const userId = req.user._id;

    if (!userId) {
        return res.status(400).json({ error: "User ID is missing" });
    }

    try {
        // Find the favorite entry for the user and item
        let favorite = await Favorite.findOne({ user: userId, itemId });

        if (favorite) {
            // If a favorite exists, update the status
            favorite.status = !favorite.status; // Toggle the status
            console.log(`Updated favorite status for item: ${itemId} to ${favorite.status}`);
            await favorite.save();
            return res.json({ isFavorite: favorite.status });
        } else {
            // If no favorite exists, create a new entry with status true
            favorite = new Favorite({ user: userId, itemId, status: true });
            console.log(`Added favorite for item: ${itemId}`);
            await favorite.save();
            return res.json({ isFavorite: favorite.status });
        }
    } catch (error) {
        console.error('Error saving favorite:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Fetch favorites for a specific user
app.get('/favorites', authMiddleware, async (req, res) => {
    try {
      const favorites = await Favorite.find({ user: req.user._id, status: true })  .populate('itemId', null, null, { strictPopulate: false }).exec(); // Filter only active favorites
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });
  
  
app.get("/proxy/fachinfo", async (req, res) => {
    // const url = req.params.url;
    const authNr = req.query.authnr;

    console.log(authNr)
    const url = `https://swissmedicinfo.ch/showText.aspx?textType=FI&lang=EN&authNr=${authNr}&supportMultipleResults=1`
    try {
        // const url = req.params.url;
        if (!url) return res.status(400).json({ error: "Missing URL" });
        
        const response = await fetch(url);
        const html = await response.text();
        
        // Use Cheerio to parse the HTML
        const $ = cheerio.load(html);
        const article = $(".monographie-content").html(); // Extract the content inside the <article>
        // console.log(article)
        res.send(article);
   if (!article) {
     return res.status(404).json({ error: "Fachinformation not found" });
   }

//    res.send(article);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Swissmedic content" });
  }
});

// app.listen(5002, () => console.log("Server running on port 5002"));
  
  



// // Start the server
// app.listen(5001, () => {
//     console.log('Server running on port 5001');
// });     


const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});