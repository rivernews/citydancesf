import { chromium } from 'playwright';

const ACCEPTED_DAY_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", 
  "Thursday", "Friday", "Saturday"
];

interface ImageModel {
  alt?: string | null;
  thumbnailImageUrl: string;
  isClass: boolean;
  link?: string | null;
}

const validateDayOfWeekInput = (dayOfWeekInput: string) => {
  return ACCEPTED_DAY_OF_WEEK.some(accepted => {
    return accepted.trim().toUpperCase() === dayOfWeekInput.trim().toUpperCase()
  })
}

const scrapeClassImagesOfDay = (images: ImageModel[], _dayOfWeek: string = '') => {
  if (!validateDayOfWeekInput(_dayOfWeek)) {
    throw Error('Please specific DAY=... in env var, DO NOT use abbreviation. e.g. use `friday` instead of `fri`')
  }

  console.log(`Filtering ${_dayOfWeek} classes from ${images.length} catalog items`)

  const dayOfWeek = _dayOfWeek?.trim();
  const qualifiedDayStrings = [
    dayOfWeek.toUpperCase(),
    dayOfWeek.slice(0, 3).toUpperCase()
  ]

  /**
   * Pattern: !isClass, !, isClass, isClass, ...., !isClass, 
   * Consecutive !isClass -> consecutive isClass -> !isClass
   *                          ^^^^^^ target classes
   * 
   * Sometimes a schedule is provided (image contains ALL classes of the day)
   *  alt = SCHEDULE FOR FRIDAY APRIL 17TH (as an example, but this format is not guaranteed)
   */

  let pointer = 0;
  let firstClassPointer = -1;
  let lastClassPointer = -1;

  // find qualified day
  while (pointer < images.length) {
    const image = images[pointer];

    if (!image.isClass) {
      if (qualifiedDayStrings.some((dayMatchString => {
        // try to match a whole word (match FRI, but not FRIDDY)
        const altTokens = image.alt?.trim().toUpperCase().split(/[^a-zA-Z]/);
        console.log('altTokens', altTokens, '...matching', qualifiedDayStrings)
        return altTokens?.some(altToken => altToken === dayMatchString);
      }))) {
        break;
      }
    }
    pointer++;
  }
  console.log(`${dayOfWeek} item start from ${images[pointer]} (index=${pointer})`);

  // find first class of that day
  while (pointer < images.length) {
    const image = images[pointer];

    if (image.isClass) {
      firstClassPointer = pointer;
      break;
    }
    pointer++;
  }

  // find all classes
  while (pointer < images.length) {
    const image = images[pointer];

    if (!image.isClass) {
      lastClassPointer = pointer - 1;
      break;
    }
    pointer++;
  }

  return images.slice(firstClassPointer, lastClassPointer + 1);
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
      const isClass = await catalogItem.evaluate(element => element.classList.contains('has-clickthrough'));

      const link = await catalogItem.evaluate(eleemnt => eleemnt.querySelector('a')?.href)

      const imageLocator = await catalogItem.locator('img')
      
      const imageSource = await imageLocator.getAttribute('src') 
        || await imageLocator.getAttribute('data-src')
        || await imageLocator.getAttribute('data-image');
      const alt = await imageLocator.getAttribute('alt')

      return {
        alt,
        thumbnailImageUrl: imageSource as string,
        isClass,
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
  })
  .catch(console.error);