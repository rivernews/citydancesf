# Search Dance Class Information

## Usage

Specify a day of week and run:

```
DAY=FRIDAY npm start
```

Please replace `DAY` by the day of week you want to search for.
The script will print out a list of dance classes of that day.
The `alt` contains quick description of the class, and the thumbnail image content has complete class information.

Avoid changing `PARALLEL_ANALYZE_IMAGE` - it controls how many requests to fire at the same time.
