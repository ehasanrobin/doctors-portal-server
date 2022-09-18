const express = require("express");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
var cors = require("cors");

app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.he4j4wu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJwt(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ massage: "unauthorized" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {
    if (err) {
      return res.status(403).send({ massage: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const database = client.db("doctorsPortal");
    const services = database.collection("services");
    const bookingsCollection = database.collection("bookings");
    const usersCollection = database.collection("users");

    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = services.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/users", verifyJwt, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;

      const user = await usersCollection.findOne({ email: decodedEmail });
      const admin = user.role === "admin";
      res.send({ admin: admin });
    });
    app.put("/user/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);

        return res.send({ success: result });
      } else {
        return res.status(401).send({ massage: "forbidden" });
      }
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date;
      // all services
      const allServices = await services.find().toArray();
      // all bookings
      const query = { date: date };
      const allbookings = await bookingsCollection.find(query).toArray();
      allServices.map((service) => {
        const serviceBookings = allbookings.filter(
          (b) => b.treatmentId == service._id
        );
        const bookedSlot = serviceBookings.map((s) => s.slot);
        const available = service.slots.filter((s) => !bookedSlot.includes(s));
        service.slots = available;
      });
      res.send(allServices);
    });

    app.get("/booking", verifyJwt, async (req, res) => {
      const pEmail = req.query.email;
      const decodedEmail = req.decoded.email;
      if (pEmail === decodedEmail) {
        const query = { email: pEmail };
        const allbookings = await bookingsCollection.find(query).toArray();
        return res.send(allbookings);
      } else {
        return res.status(403).send({ massage: "forbidden access" });
      }
    });
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;

      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign({ email: email }, process.env.SECRET_KEY, {
        expiresIn: "1h",
      });
      res.send({ result, token });
    });
    app.post("/booking", async (req, res) => {
      const data = req.body;
      const query = {
        treatmentId: data.treatmentId,
        email: data.email,
        date: data.date,
      };
      const exist = await bookingsCollection.findOne(query);
      if (exist) {
        return res.send({ sucess: false, booking: exist });
      }
      const result = await bookingsCollection.insertOne(data);
      res.send({ success: true, booking: result });
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
