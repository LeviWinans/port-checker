## PORT Gallery
    scrape-gallery.js

# Instructions
    Update targets in scrape-gallery.js

### Get Pages
`baseUrlPrefix`
    const baseUrlPrefix = 'https://www.riserejuvenationcenter.com/gallery-procedure/';
`subcategories` (gallery endpoints)
    const subcategories = ['fillers', 'bio-gel', 'tox-treatment', 'weight-loss-program-with-semaglutide']; 

### Find Article
`articlesTarget`
    const articlesTarget = 'article';

### Get Images
`imageTarget`
    const imageTarget = '.before-image img, .after-image img';
    Creates jpg images ordered 01, 02, 03, etc.
### Get Text
`titleTarget`
    const titleTarget = '.entry-title > a';
    Creates `title.txt`
`subtitleTarget`
    const subtitleTarget = '.case-id';
    Creates `subtitle.txt`
`indexTarget`
    const indexTarget = '.view-angle';
    Creates `index.html`


# Upload Instructions

Upload folders should be in the following format:

/category/subcategory/patient/

which will be uploaded as:

/gallery/category/subcategory/patient/ on the site.

The following files can be added for each patient:

the patient images - ordered 01, 02, 03, etc in the order they are to appear on the site

`index.html` (the html text of the gallery description. 
Important note: This cannot include divs, spans, br, hr, etc. and should only be the text description. this can, however, utilize the [.classname] syntax used elsewhere)

`title.txt` (the custom title for the patient page)

`subtitle.txt` (the custom subtitle for the patient page)

`friendly.txt` (the custom display title of the patient on the subcategory index page)


Note that the title.txt and subtitle.txt can also use the [.classname] syntax

You can also include a `procedurelink.txt` file. This file should contain the relative URL of the procedure page you want the gallery to link to (for example: /body/liposuction/). When present, it automatically connects that patient’s gallery to the correct procedure page.

In addition, you can choose a default masthead image for the category. This masthead will appear on all subcategory and patient pages unless you override it with a different image later.