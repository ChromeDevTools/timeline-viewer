var gulp = require('gulp'),
    webserver = require('gulp-webserver'),
    rename = require('gulp-rename'),
    ghPages = require('gulp-gh-pages');

gulp.task('config:dev', function () {
    gulp.src('config_dev.js')
        .pipe(rename('config.js'))
        .pipe(gulp.dest('src/'))    
});

gulp.task('config:prod', function () {
    gulp.src('config_prod.js')
        .pipe(rename('config.js'))
        .pipe(gulp.dest('src/'))    
});

gulp.task('dev', ['config:dev'], function () {
    gulp.src('src')
        .pipe(webserver({

        }))
})

gulp.task('deploy', ['config:prod'], function () {
    return gulp.src('./src/**/*')
        .pipe(ghPages());       
})