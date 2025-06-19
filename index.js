const express = require('express');
require('dotenv').config()
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000
const admin = require("firebase-admin");
const decodedBase64 = Buffer.from(process.env.FIREBASE_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedBase64);

app.use(cors())
app.use(express.json());
app.use(cookieParser());


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



// middleware for verify token
// const verifyToken = (req, res, next) => {
//   const token = req.cookies.token;
//   if(!token){
//     return res.status(401).send({message: 'Unauthorize Access!'});
//   };

//   // verify token
//   jwt.verify(token, process.env.JWT_ACCESS_SECRETE, (error, decoded) => {
//     if(error){

//       return res.status(401).send({message: 'Unauthorize Access!'})
//     }
//     req.decoded = decoded;
//   })
//     next()
// }

// varifyToken with firebase admin
const verifyFirebaseToken = async(req, res, next) => {
  const authInfo = req.headers.authorization;
  
  if(! authInfo){
    return res.status(401).send({message: 'Unauthorized access!'})
  }
  const token = authInfo.split(' ')[1];
  const decoded = await admin.auth().verifyIdToken(token);
  req.decoded = decoded;
  next()

  // verify token
  // try{
    
  //   console.log(decoded);
  // }
  // catch(error){
  //   return res.status(401).send({message: 'Unauthorized access!'})
  // }
  

}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7f7yugv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const jobsCollection = client.db('careerCode').collection('jobs');
    const applicationsCollection = client.db("careerCode").collection('applications');


    // jwt related api
    // app.post('/jwt', async(req, res) => {
    //   const userData = req.body;
    //   const token = await jwt.sign(userData, process.env.JWT_ACCESS_SECRETE, {expiresIn: '1h'});
    //   // set the token to the cookies
    //   res.cookie('token', token, {
    //     httpOnly: true,
    //     secure: false
    //   })
    //   res.send({success: true})
    // })


    // jobs ralated apis
    app.get('/jobs', async(req, res) => {

        const email = req.query.email;
        const query = {};
        if(email){
          query.hr_email = email;
        }
        const cursor = jobsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result)
    })

    app.get('/jobs/applications', verifyFirebaseToken, async(req, res) => {
      const email = req.query.email;
      const query = {hr_email: email};
      const jobs = await jobsCollection.find(query).toArray();

      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access!'})

      }
      for(const job of jobs) {
        const applicationQuery = {jobId: job._id.toString()};
        const application_count = await applicationsCollection.countDocuments(applicationQuery);
        job.application_count = application_count;
      }
      res.send(jobs);
    })

    // single job api
    app.get('/jobs/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await jobsCollection.findOne(query);
        res.send(result)
    })

    app.post('/jobs', async(req, res) => {
      const newJob = req.body;
      console.log(newJob);
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    })

    
    // applications related apis
    app.get('/applications', verifyFirebaseToken, async(req, res) => {
        const email = req.query.email;
        const query = {
            applicant: email,
          }
          
          // verifing with the cookie token 
          // if(email !== req.decoded.email){
          //   return res.status(403).send({message: 'Forbidden Accesss!'})
          // }

          // // verifing with firebase token
          if(email !== req.decoded.email){
            return res.status(403).send({message: 'forbidden access!'})
          }
          const result = await applicationsCollection.find(query).toArray();

        // badway 
        for(const application of result){
          const jobId = application.jobId;
          const jobQuery = {_id: new ObjectId(jobId)};
          const job = await jobsCollection.findOne(jobQuery);
          application.company = job.company;
          application.title = job.title;
          application.company_logo = job.company_logo
        }
        res.send(result);
      })
      
      app.get('/applications/job/:job_id', async(req, res) => {
        const job_id = req.params.job_id;
        const query = {jobId: job_id};
        const result = await applicationsCollection.find(query).toArray();
        res.send(result);
      })

      app.get('/applications/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await applicationsCollection.findOne(query);
        res.send(result);
      })

    app.post('/applications', async(req, res) =>{
        const application = req.body;
        const result = await applicationsCollection.insertOne(application)
        res.send(result)
    })

    app.patch('/applications/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          status : req.body.status
        }
      }
      const result = await applicationsCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.delete('/applications/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await applicationsCollection.deleteOne(query);
      res.send(result)

    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('career code server in running')
})

app.listen(port, () =>{
    console.log(`career code server is runnig on Port ${port}`)
})

