"use strict";

const { MongoClient } = require("mongodb");
const express = require("express");
const cors = require("cors");
const { DOWNLOAD } = require("./API");
const fs = require("fs");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();
const jwt = require("jsonwebtoken");

const dbUrl = `mongodb+srv://admin:bjX2dGUEnrK4Zyd@cluster0.vl3pn.mongodb.net/food?retryWrites=true&w=majority`;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

var client = new MongoClient(dbUrl);
client.connect();

const fetchPendingAcronyms = async (client, environment) => {
  let collection = client
    .db(`mortgagebanking-${environment}`)
    .collection("pending-acronyms");

  const results = await collection.find({}).toArray();
  return results;
};

const uploadPendingAcronym = (acronym, client, environment, callback) => {
  let collection = client
    .db(`mortgagebanking-${environment}`)
    .collection("pending-acronyms");

  collection.insertOne(acronym, (err, result) => {
    if (err) callback(false);

    if (result.acknowledged) {
      console.log(
        `Inserted 1 new document into mortgagebanking-${environment}.`
      );
      callback(true);
    }
  });
};

const _loadCollection = async (client) => {
  try {
    let collection = client
      .db("mortgagebanking-production")
      .collection("acronyms");

    return collection;
  } catch (err) {
    console.log(err);
  }
};

const _loadArticles = async (environment, client) => {
  try {
    const collection = client
      .db(`mortgagebanking-${environment}`)
      .collection("articles-metadata");
    return collection;
  } catch (err) {
    console.log(err);
  }
};

const _loadUsers = async (environment, client) => {
  try {
    const collection = client
      .db(`mortgagebanking-${environment}`)
      .collection("users");
    if (collection) {
      return collection.find({}).toArray();
    }
  } catch (err) {
    console.log(err);
  }
};

const _parseTextFromMarkdown = async (file, callback) => {
  await fs.readFile(file, "utf-8", (err, data) => {
    if (err) {
      console.log(err);
      console.log(`Failed to parse markdown file ${file}.`);
    }
    callback(data);
  });
};

const _genBase64FromImg = async (file, callback) => {
  await fs.readFile(file, "base64", (err, data) => {
    if (err) console.log(err, `Failed to parse base64 from file ${file}`);
    callback(data);
  });
};

const _loadImg = async (filename, environment, callback, client) => {
  try {
    const path = `/tmp/${filename}`;
    const download = await DOWNLOAD(
      client,
      filename,
      environment,
      "articles-images"
    );

    if (download) {
      await _genBase64FromImg(path, (data) => {
        callback(data);
      });

      await fs.unlink(path, () => {
        console.log(`Removed temp file ${path}`);
      });

      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const _loadMarkdown = async (filename, environment, callback, client) => {
  try {
    const path = `/tmp/${filename}`;

    const download = await DOWNLOAD(
      client,
      filename,
      environment,
      "articles-markdown"
    );

    if (download) {
      await _parseTextFromMarkdown(path, (text) => {
        callback(text);
      });

      await fs.unlink(path, () => {
        console.log(`Removed temp file ${path}`);
      });
      return true;
    } else {
      return false;
    }
  } catch {
    return false;
  }
};

app.get("/markdown/production/:markdownFile", async (req, res) => {
  try {
    const validArticle = await _loadMarkdown(
      req.params.markdownFile,
      "production",
      (text) => {
        if (text) {
          res.json({ validArticle: true, text: text });
        }
      },
      client
    );
    if (!validArticle) {
      res.json({ validArticle: false, text: "" });
    }
  } catch (err) {
    console.log(err);
    res.json({ message: "failed?" });
  }
});

app.get("/markdown/staging/:markdownFile", async (req, res) => {
  try {
    const validArticle = await _loadMarkdown(
      req.params.markdownFile,
      "staging",
      (text) => {
        if (text) {
          res.json({ validArticle: true, text: text });
        }
      },
      client
    );
    if (!validArticle) {
      res.json({ validArticle: false, text: "" });
    }
  } catch (err) {
    console.log(err);
    res.json({ message: "Failed. Internal server error." });
  }
});

app.get("/images/staging/:imgFile", async (req, res) => {
  try {
    const validImg = await _loadImg(
      req.params.imgFile,
      "staging",
      (base64Str) => {
        if (base64Str) res.json({ validImg: true, url: base64Str });
        if (!base64Str) res.json({ validImg: false, url: "" });
      },
      client
    );
    if (!validImg) res.json({ validImg: false, url: "" });
  } catch (err) {
    console.log(err);
    res.json({ message: "Failed. Internal server error." });
  }
});

app.get("/images/production/:imgFile", async (req, res) => {
  try {
    const validImg = await _loadImg(
      req.params.imgFile,
      "production",
      (base64Str) => {
        if (base64Str) res.json({ url: base64Str });
      },
      client
    );
    if (!validImg) res.json({ validImg: false, url: "" });
  } catch (err) {
    console.log(err);
    res.json({ message: "Failed. Internal server error." });
  }
});

app.get("/articles/staging", async (req, res) => {
  try {
    let collection = await _loadArticles("staging", client);
    collection.find({}).toArray((err, results) => {
      if (err) console.log(err);
      res.send(results);
    });
  } catch (err) {
    console.log(err);
    res.send("Failed to retrieve from database.");
  }
});

app.get("/articles/production", async (req, res) => {
  try {
    let collection = await _loadArticles("production", client);
    collection.find({}).toArray((err, results) => {
      if (err) console.log(err);
      res.send(results);
    });
  } catch (err) {
    console.log(err);
    res.send("Failed to retrieve from database.");
  }
});

app.get("/search", async (req, res) => {
  try {
    let collection = await _loadCollection(client);

    let term = req.query.term;

    let result = await collection
      .aggregate([
        {
          $search: {
            autocomplete: {
              query: term,
              path: "Acronym",
            },
          },
        },
        { $limit: 50 },
        {
          $project: {
            _id: 1,
            Acronym: 1,
            Citation: 1,
            "Description of use": 1,
            "Date Entered": 1,
            Text: 1,
            Definition: 1,
            score: { $meta: "searchScore" },
          },
        },
      ])
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(502).send({ errorMessage: err.message });
  }
});

app.post("/checkAuthentication", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    res.status(400).send({ validToken: false });
    return;
  }

  console.log("req.body", req.body);
  console.log("token", token);

  const validToken = jwt.verify(token, process.env.SECRET_OR_KEY);

  if (validToken) {
    res.status(200).send({ validToken: true });
    console.log("valid token");
  } else {
    res.status(200).send({ validToken: false });
  }
});

app.get("/pendingAcronyms", async (req, res) => {
  const pendingAcronysm = await fetchPendingAcronyms(client, "staging");

  if (pendingAcronysm) {
    res.status(200).send({ pendingAcronysm: pendingAcronysm });
  } else {
    res.status(500).send({
      serverMessage: "Failed to retrieve pending acronyms from MongoDB.",
    });
  }
});

app.post("/uploadAcronym", async (req, res) => {
  const newAcronym = req.body;

  if (newAcronym) {
    // upload that shit

    uploadPendingAcronym(newAcronym, client, "staging", (success) => {
      if (success) {
        res
          .status(200)
          .send({ serverMessage: "new Acronym recieved, hell yeah" });
      } else {
        res.status(200).send({
          serverMessage:
            "Error: Acronym recieved, but failed to upload to MongoDB.",
        });
      }
    });

    // if (!newAcronym)
  } else {
    res.status(404).send({
      serverMessage: "Acronym not provided, or incorrect acronym format.",
    });
  }
});

app.post("/admin", async (req, res) => {
  const { name, password } = req.body;

  const findUserInDB = (name, users) => {
    for (let userObj of users) {
      if (userObj.name === name) return userObj;
    }
  };

  if (name && password) {
    const users = await _loadUsers("staging", client);
    const matchingUser = findUserInDB(name, users);

    if (!matchingUser) {
      res.status(400).send({ serverMessage: "User not found in database." });
    } else {
      const storedName = matchingUser.name;
      const storedPassword = matchingUser.password;

      // Can we assume that the checks above will ensure that storedName and
      // storedPassword will exist? If so we can get rid of the lower else statement.
      if (storedName && storedPassword) {
        bcrypt.compare(password, storedPassword, (err, passwordsMatch) => {
          if (err) console.log(err);
          if (passwordsMatch) {
            const payload = { name: name };
            const token = jwt.sign(payload, process.env.SECRET_OR_KEY);
            res.status(200).send({
              token: token,
              authenticated: true,
              serverMessage: "",
            });
          } else {
            res.status(200).send({
              authenticated: false,
              serverMessage: "Passwords do not match.",
            });
          }
        });
        // This one below.
      } else {
        console.log("no stored name/password");
      }
    }
  }
});

app.get("/", (req, res) => {
  res.status(200).send({ serverMessage: "app running!" });
});

module.exports = app;
