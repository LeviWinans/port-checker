# PORT QA
    sort.txt & run-comparison.js

## Steps
    Step 1: Update Outline
        sort.txt Copy and paste 3 columns 
            (Existing Page | Google Doc | URL) 
    Step 2: Update domains
        parse-sort.js consts oldBaseUrl & newBaseUrl domains
    Step 3: Run 
        node run-comparison.js  
            Runs: 
                node parse-sort.js
                node scrape-content.js
                node compare-content.js
    Step 4:    
        /comparison_results/
            Check results & make necessary updates
            Move to /success/ when completed
    

## Details:
    sort.txt
        Copy Old & New Urls w/ copy source
            Copy and paste 3 columns:
                (Existing Page | Google Doc | URL) 

    parse-sort.js
        Parse Outline Old and New Urls
        Update const oldBaseUrl & newBaseUrl domains
            Creates pages-sorted.json

    scrape-content.js
        Scrape Old and New page content
            Scrapes pages from pages-sorted.json
            Creates scraped_content folder with old.txt & new.txt within endpoint folders

    compare-content.js
        Compare Old and New page content
            Compares old.txt & new.txt to each other and notes missing old.txt copy
            creates /comparison_results/endpoint.txt for each missing old PORT content

    compare-titles.js (this is still a work in progress)
        Compare Old and New page heading tags & title copy
            Scrapes title copy & tags from pages on pages-sorted.json
            Creates compared-titles.txt and displays comparison results


## CHECK RESULTS
    /comparison_results/...
        Compare results
            Check results & make necessary updates
            Move to /success/ when completed
    compared-titles.txt
        Compare titles


## npm
    npm init -y
    npm i cheerio axios
    nvm install --lts