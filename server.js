const express = require('express');
const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

const app = express();
const PORT = 3000;
app.use(express.json());

app.get('/', async (req, res) => {
  try {
    await prisma.user.create({
      data: {
        name: 'Alice',
        email: '123@prisma.io',
        posts: {
          create: { title: 'Hello World' },
        },
        profile: {
          create: { bio: 'I like turtles' },
        },
      },
    });
    const allUsers = await prisma.user.findMany({
      include: {
        posts: true,
        profile: true,
      },
    });
    console.log(allUsers);
    res.json(allUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching users.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server ready at: http://localhost:${PORT}`);
});
