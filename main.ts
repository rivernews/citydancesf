import { chromium } from 'playwright';

const ACCEPTED_DAY_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", 
  "Thursday", "Friday", "Saturday"
];

const validateDayOfWeekInput = (dayOfWeekInput: string) => {
  return ACCEPTED_DAY_OF_WEEK.some(accepted => {
    return accepted.trim().toUpperCase() === dayOfWeekInput.trim().toUpperCase()
  })
}

const getDayOfWeekInput = () => {
  const rawInput = (process.env.DAY as string || '').trim();
  if (!validateDayOfWeekInput(rawInput)) {
    throw new Error(`Day of week invalid: ${rawInput}`);
  }
  return rawInput;
}

const getAllQualifiedStrings = (dayOfWeek: string) => {
  return [
    dayOfWeek.toUpperCase(),
    dayOfWeek.slice(0, 3).toUpperCase()
  ];
}

const QUALIFIED_DAY_OF_WEEK_INPUT_STRINGS = getAllQualifiedStrings(getDayOfWeekInput());

interface ImageModel {
  alt?: string | null;
  thumbnailImageUrl: string;
  link?: string | null;
}

const getCurrentAndNextDayOfWeekIndicies = (sanitizedDayOfWeek: string) => {
  const currentDayIndex = ACCEPTED_DAY_OF_WEEK.findIndex((accepted) => accepted.toUpperCase() === sanitizedDayOfWeek.toUpperCase());
  const nextDayIndex = currentDayIndex + 1 === ACCEPTED_DAY_OF_WEEK.length ? 
    0 :
    currentDayIndex + 1;
  
  return [currentDayIndex, nextDayIndex];
}

const _containsDayOfWeek = (qualifiedDayOfWeekStrings: string[], text?: string | null) => {
  return qualifiedDayOfWeekStrings.some((dayMatchString => {
        // try to flexible-match a whole word (match FRI & FRIDAYS or even FRIDAYSSS, but not FRIDDY)
        const altTokens = text?.trim().toUpperCase().split(/[^a-zA-Z]/);
        console.log('altTokens', altTokens, '...matching', QUALIFIED_DAY_OF_WEEK_INPUT_STRINGS)
        return altTokens?.some(altToken => altToken.includes(dayMatchString));
      }))
}

const containsDayOfWeekInput = (text?: string | null) => {
  return _containsDayOfWeek(QUALIFIED_DAY_OF_WEEK_INPUT_STRINGS, text);
}

const containsNextDayOfWeekInput = (text?: string | null) => {
  const [, nextDayIndex] = getCurrentAndNextDayOfWeekIndicies(getDayOfWeekInput());
  const nextDayOfWeek = ACCEPTED_DAY_OF_WEEK[nextDayIndex];
  const qualifiedNextDayOfWeekStrings = getAllQualifiedStrings(nextDayOfWeek);
  return _containsDayOfWeek(qualifiedNextDayOfWeekStrings, text);
}

const scrapeClassImagesOfDay = (images: ImageModel[], _dayOfWeek: string = '') => {
  if (!validateDayOfWeekInput(_dayOfWeek)) {
    throw Error('Please specific DAY=... in env var, DO NOT use abbreviation. e.g. use `friday` instead of `fri`')
  }

  console.log(`Filtering ${_dayOfWeek} classes from ${images.length} catalog items`)

  const dayOfWeek = _dayOfWeek?.trim();

  /**
   * Pattern: !isClass, !, isClass, isClass, ...., !isClass, 
   * Consecutive !isClass -> consecutive isClass -> !isClass
   *                          ^^^^^^ target classes
   * 
   * Sometimes a schedule is provided (image contains ALL classes of the day)
   *  alt = SCHEDULE FOR FRIDAY APRIL 17TH (as an example, but this format is not guaranteed)
   */

  let pointer = 0;
  let firstDayOfWeekInputItemPointer = -1;
  let lastDayOfWeekInputItemPointer = -1;

  // find qualified day's daily cover - first occurance is fine
  // daily cover 99% should be the first occurance (unless an earlier catalog item mentions class takes places on 2 days, etc)
  // AND, no link (not clickable. Daily cover never has links; some classes might not have link too)
  while (pointer < images.length) {
    const image = images[pointer];

    if (containsDayOfWeekInput(image.alt) && !image.link) {
      // skip daily cover, go straight to next item (could be whole day aggregator, could be class w/ link, could be class w/o link)
      firstDayOfWeekInputItemPointer = pointer + 1;
      pointer++;
      break;
    }
    pointer++;
  }
  console.log(`${dayOfWeek} item start from ${images[pointer]} (index=${pointer})`);

  // find next day item
  while (pointer < images.length) {
    const image = images[pointer];

    if (containsNextDayOfWeekInput(image.alt) && !image.link) {
      lastDayOfWeekInputItemPointer = pointer - 1;
      break;
    }
    pointer++;
  }

  if (firstDayOfWeekInputItemPointer === -1 ||
    lastDayOfWeekInputItemPointer === -1 ||
    firstDayOfWeekInputItemPointer >= lastDayOfWeekInputItemPointer
  ) {
    throw new Error(`Abnormal pointer firstDayOfWeekInputItemPointer=${firstDayOfWeekInputItemPointer}, lastDayOfWeekInputItemPointer=${lastDayOfWeekInputItemPointer}`);
  }


  return images.slice(firstDayOfWeekInputItemPointer, lastDayOfWeekInputItemPointer + 1);
}

/**
 * Scrapes image source URLs for a specific day from City Dance Studios
 * 
 * Structure:
 * div.gallery-strips-wrapper.gallery-strips-list--ready
 *  figure.gallery-strips-item (daily metadata)
 *    div
 *      img (src invisible to scraper, had to use data-src)
 *  figure.gallery-strips-item.has-clickthrough (actual class entry)
 *    div
 *      a
 *        img
 * 
 * @param dayOfWeek - The day to scrape (e.g., 'Friday', 'Saturday')
 */
async function scrapeCatalogImages() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the instructors page
  const url = 'https://www.citydancesf.com/instructors';
  await page.goto(url, { waitUntil: 'networkidle' });

  // Find all elements that might be catalogItemImage
  const catalogItems = await page.locator('div.gallery-strips-wrapper.gallery-strips-list--ready > figure.gallery-strips-item')
    .all();
  
  
  const imageResults = await Promise.allSettled(
    catalogItems.map(async (catalogItem) => {
      const link = await catalogItem.evaluate(element => element.querySelector('a')?.href)

      const imageLocator = await catalogItem.locator('img')
      
      const imageSource = await imageLocator.getAttribute('src') 
        || await imageLocator.getAttribute('data-src')
        || await imageLocator.getAttribute('data-image');
      const alt = await imageLocator.getAttribute('alt')

      return {
        alt,
        thumbnailImageUrl: imageSource as string,
        link
      } as ImageModel;
    })
  )

  const successImages = imageResults.filter(imageResult => imageResult.status === 'fulfilled').map((successResult) => successResult.value);
  const fails = imageResults.filter(imageResult => imageResult.status === 'rejected').map((successResult) => successResult.reason);

  console.log(`Found ${successImages.length}/${imageResults.length} (success/failed) catalog images`);
  console.error(fails);

  await browser.close();

  return successImages;
}

// Example usage:
scrapeCatalogImages()
  .then((images) => scrapeClassImagesOfDay(images, process.env.DAY))
  .then((imagesOfDay) => {
    console.log(`====== Here're classes of ${process.env.DAY} ======`)
    console.log(imagesOfDay)
    console.log(`====== Total: ${imagesOfDay.length} classes on ${process.env.DAY} ======`)
  })
  .catch(console.error);