# Ideas to build

1. Show airport info on map 
- Load the airports.json file and show the airports on the map. 
- Let me click on an airport and either add it to the departure or arrival airport.

2. Add a home page that shows a world map all of my routes
- [x] Load the routes on the map from local storage
- [x] Show all the logs under the map in a list and let me click on a log entry to view it.
- Show me the total distance of all routes.
- Show me the total time of all routes.
- Show me the total distance of all routes that I flew in the last 30 days.
- Show me the total distance of all routes that I flew in the last 7 days.
- Show me the total distance of all routes that I flew in the last 24 hours.

3. Persist flight logs to a database, adding user authentication with Clerk
- This will require a backend with authentication with google (using clerk)
- Use NeonDB to persist logs to a database
- Use NextJS to create the backend
- Use Vercel to host the app 

