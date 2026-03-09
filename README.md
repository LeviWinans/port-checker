# PORT Checker

## Notes:
    PORT-QA was created to check for missing copy going from the PORT to dev page.



## PORT-QA:
    Goal: Ensure all copy from PORT page is on Dev page
    Run: run-comparison.js
        Update domains on scrape-content.js
        Add 3 columns to sort.txt
        node run-comparison.js
    Run: node compare-titles.js 

    If you need to change the PORT Page scrape element/class targets, go to: scrape-content.js

## PORT-PDF
    Goal: scrape pdfs from page

## PORT-IMG
    Goal: scrape images from page

## PORT-gallery
    Goal: scrape galleries from pages