require('dotenv').config();
const express = require('express');
// https://expressjs.com/en/starter/basic-routing.html

const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;





// --------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4fyu693.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
        //   await client.connect();
        // Send a ping to confirm a successful connection
        //   await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");



        const userCollection = client.db("GrandGatewayDB").collection("users");
        const bookCollection = client.db("GrandGatewayDB").collection("book");
        const reviewCollection = client.db("GrandGatewayDB").collection("review");


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' });
            // console.log(token);
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }


        // verify Deliveryman

        const verifyDeliveryman = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isDeliveryman = user?.role === 'deliveryman';
            if (!isDeliveryman) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }





        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 
            // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // get all the users

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });


        app.get('/users/all', async (req, res) => {
            try {
                const count = await userCollection.estimatedDocumentCount();
                res.send({ count });  // Return as an object, not just a number
            } catch (error) {
                console.error('Error fetching user count:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });




        app.get('/users/email/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            try {
                const result = await userCollection.findOne({ email: email }); // Use findOne instead of find().toArray()
                res.send(result);
            } catch (error) {
                console.error('Error fetching user by email:', error);
                res.status(500).send('Internal Server Error');
            }
        });






        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })



        // make role to admin
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        // delete one user
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })





        // for deliveryman
        app.get('/users/deliverymanrelod/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let deliveryman = false;
            if (user) {
                deliveryman = user?.role === 'deliveryman';
            }
            console.log("testing deliveryman",deliveryman);
            res.send({ deliveryman });
        })
        


        // MyDeliverylist  er just _id pawar jonno banano
        app.get('/users/oneDeliveryman/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send({ user });
        })

        app.patch('/users/deliveryman/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'deliveryman'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // get all the delivery man for admin
        app.get('/users/deliverymen', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const deliverymen = await userCollection.find({ role: 'deliveryman' }).toArray();
                res.send(deliverymen);
            } catch (error) {
                res.status(500).send({ message: 'Error retrieving deliverymen', error });
            }
        });


        // image upload update



        app.patch('/users/imgUpload/:email', verifyToken, async (req, res) => {
            const { image } = req.body;  // Extract image URL from request body
            const email = req.params.email;  // Get email from route params

            try {
                const filter = { email: email };  // Match user by email
                const updatedDoc = {
                    $set: { image2: image }  // Store new image URL in `image2`
                };

                const result = await userCollection.updateOne(filter, updatedDoc);

                if (result.modifiedCount > 0) {
                    res.send({ success: true, message: "Image updated successfully" });
                } else {
                    res.status(404).send({ success: false, message: "User not found or no changes made" });
                }
            } catch (error) {
                console.error("Error updating user image:", error);
                res.status(500).send({ success: false, message: "Internal Server Error" });
            }
        });




        // booking data

        app.post('/book', verifyToken, async (req, res) => {
            const item = req.body;
            const result = await bookCollection.insertOne(item);
            res.send(result);
        });

        app.get('/book', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await bookCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/book/email/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            try {
                const result = await bookCollection.find({ email: email }).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching tutorials by category:', error);
                res.status(500).send('Internal Server Error');
            }
        });
        // get all the booking for admin

        app.get('/book/all', verifyToken, verifyAdmin, async (req, res) => {
            const result = await bookCollection.find().toArray();
            res.send(result);
        });
        
        // public route for banner total num of booked items
        app.get('/book/all/forbanner', async (req, res) => {
            try {
                const count = await bookCollection.estimatedDocumentCount();
                res.send({ count });  // Return as an object, not just a number
            } catch (error) {
                console.error('Error fetching user count:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        app.get('/book/all/forbanner/delivered', async (req, res) => {
            try {
                const count = await bookCollection.countDocuments({ status: "delivered" }); // ✅ Correct way to count filtered docs
                res.send({ count }); // ✅ Send response as an object
            } catch (error) {
                console.error('Error fetching delivered book count:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        app.get('/book/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.findOne(query);
            res.send(result);
        })


        app.put('/book/:id', verifyToken, async (req, res) => {
            const id = req.params.id;

            // https://www.mongodb.com/docs/drivers/node/current/usage-examples/updateOne/

            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: req.body
            }

            const result = await bookCollection.updateOne(filter, updatedDoc, options)
            // console.log(result)
            res.send(result);
        })



        app.get('/book/AllBookByDeliveryId/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            try {
                const result = await bookCollection.find({ deliveryMan_Id: id }).toArray();
                if (result) {
                    // console.log(result)
                    res.send(result);
                }

                else {
                    res.send("not found");
                }
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'An error occurred while fetching books.' });
            }



        });


        app.patch('/book/:id', verifyToken, async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {

                    deliveryMan_Id: item.deliveryMan_Id,
                    approximateDate: item.approximateDate,
                    status: "On The Way",

                }
            }

            const result = await bookCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })


        app.patch('/book/cancel/:id', verifyToken, async (req, res) => {
            // const item = req.body;
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: { status: "canceled" }

            }

            const result = await bookCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })


        app.patch('/book/deliver/:id', verifyToken, async (req, res) => {
            // const item = req.body;
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: { status: "delivered" }

            }

            const result = await bookCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })



        // review section


        app.post('/review', verifyToken, async (req, res) => {
            const item = req.body;
            const result = await reviewCollection.insertOne(item);
            res.send(result);
        });



        app.get('/review/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await reviewCollection.find({ deliveryManID: id }).toArray();
            res.send(result);
        })


        // aggregation

        app.get('/api/deliverymen', verifyToken, async (req, res) => {
            try {
                // const users = await userCollection.find({ role: 'deliveryman' }).toArray();
                const deliveryMen = await userCollection.aggregate([
                    {
                        $match: { role: 'deliveryman' } // Ensure we only get deliverymen
                    },


                    {
                        $addFields: {
                            _id: { $toString: '$_id' }, //convert plantId string field to objectId field



                        },
                    },

                    {
                        $lookup: {
                            from: 'book', // Ensure this matches the actual collection name
                            localField: '_id',
                            foreignField: 'deliveryMan_Id', // Ensure this matches the field in the book collection
                            as: 'books'
                        }
                    },


                    {
                        $project: {
                            name: 1, // Assuming deliveryBoy has a 'name' field
                            email: 1,
                            phone: 1,
                            deliveredCount: {
                                $size: {
                                    $filter: {
                                        input: "$books",
                                        as: "booking",
                                        cond: { $eq: ["$$booking.status", "delivered"] }
                                    }
                                }
                            }
                        }
                    },

                    {
                        $lookup: {
                            from: 'review', // Ensure this matches the actual collection name
                            localField: '_id',
                            foreignField: 'deliveryManID', // Ensure this matches the field in the review collection
                            as: 'reviews'
                        }
                    },

                    {
                        $project: {
                            name: 1, // Assuming deliveryBoy has a 'name' field
                            email: 1,
                            phone: 1,
                            deliveredCount: 1,
                            averageRating: {
                                $avg: {
                                    $map: {
                                        input: "$reviews",
                                        as: "review",
                                        in: { $toDouble: "$$review.ratings" } // Convert string to number
                                    }
                                }
                            }
                        }
                    },


                ]).toArray();

                res.send(deliveryMen);
            } catch (error) {
                console.error('Aggregation error:', error); // Log the error for debugging
                res.status(500).json({ message: 'Server error' });
            }
        });


        // bar chart data
        app.get('/api/bookings-by-date', verifyToken, async (req, res) => {
            try {
                const bookings = await bookCollection.aggregate([
                    {
                        $group: {
                            _id: "$bookingDate", // Group by requested delivery date
                            totalBookings: { $sum: 1 } // Count the number of bookings for each date
                        }
                    },
                    {
                        $sort: { _id: 1 } // Sort by date
                    }
                ]).toArray();

                res.json(bookings);
            } catch (error) {
                console.error('Error fetching bookings by date:', error);
                res.status(500).json({ message: 'Server error' });
            }
        });


        // line chart
        app.get('/api/bookings-and-deliveries-by-date', verifyToken, async (req, res) => {
            try {
                const bookings = await bookCollection.aggregate([
                    {
                        $group: {
                            _id: "$requestedDeliveryDate", // Group by requested delivery date
                            totalBookings: { $sum: 1 }, // Count the number of bookings for each date
                            totalDelivered: {
                                $sum: {
                                    $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] // Count delivered parcels
                                }
                            }
                        }
                    },
                    {
                        $sort: { _id: 1 } // Sort by date
                    }
                ]).toArray();

                res.json(bookings);
            } catch (error) {
                console.error('Error fetching bookings and deliveries by date:', error);
                res.status(500).json({ message: 'Server error' });
            }
        });





        app.get('/api/users-with-bookings', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const users = await userCollection.aggregate([
                    {
                        $addFields: {
                            _id: { $toString: '$_id' } // Convert _id to string for compatibility
                        }
                    },
                    {
                        $lookup: {
                            from: 'book', // Ensure this matches the actual collection name
                            localField: 'email', // Match users based on email
                            foreignField: 'email', // Email field in bookCollection
                            as: 'bookings' // Store matched bookings in an array
                        }
                    },
                    {
                        $project: {
                            name: 1,
                            email: 1,
                            phone: 1,
                            role: 1,
                            bookedCount: { $size: "$bookings" } // Count the number of bookings
                        }
                    }
                ]).toArray();

                console.log(users);
                res.send(users);
            } catch (error) {
                console.error('Aggregation error:', error);
                res.status(500).json({ message: 'Server error' });
            }
        });



    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Yaaaa!, You Have done well ha ha!!!! ')
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})