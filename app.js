"use strict";

const { MongoClient } = require("mongodb");
const express = require("express");
const cors = require("cors");
const { DOWNLOAD } = require("./API");
const fs = require("fs");

const dbUrl = `mongodb+srv://admin:bjX2dGUEnrK4Zyd@cluster0.vl3pn.mongodb.net/food?retryWrites=true&w=majority`;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const _loadCollection = async () => {
  try {
    const client = new MongoClient(dbUrl);
    await client.connect();
    let collection = client.db("mortgagebanking").collection("acronymsv4");

    return collection;
  } catch (err) {
    console.log(err);
  }
};

const _loadArticles = async (environment) => {
  try {
    const client = new MongoClient(dbUrl);
    await client.connect();
    const collection = client
      .db(`mortgagebanking-${environment}`)
      .collection("articles-metadata");
    return collection;
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

const _loadMarkdown = async (filename, environment, callback) => {
  try {
    const client = new MongoClient(dbUrl);
    await client.connect();

    const path = `/tmp/${filename}`;

    const download = await DOWNLOAD(client, filename, environment);

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

app.get("/static/2ae1a1_7f4a8fa04151482393b30763e9830e59.pdf", (req, res) => {
  res.sendFile("/static/2ae1a1_7f4a8fa04151482393b30763e9830e59.pdf", {
    root: __dirname,
  });
});

app.get("/markdown/production/:markdownFile", async (req, res) => {
  try {
    const validArticle = await _loadMarkdown(
      req.params.markdownFile,
      "production",
      (text) => {
        if (text) {
          res.json({ validArticle: true, text: text });
        }
      }
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
      }
    );
    if (!validArticle) {
      res.json({ validArticle: false, text: "" });
    }
  } catch (err) {
    console.log(err);
    res.json({ message: "failed?" });
  }
});

app.get("/articles/staging", async (req, res) => {
  try {
    let collection = await _loadArticles("staging");
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
    let collection = await _loadArticles("production");
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
    let collection = await _loadCollection();

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

app.get("/", (req, res) => {
  res.status(200).send({ serverMessage: "app running!" });
});

module.exports = app;
